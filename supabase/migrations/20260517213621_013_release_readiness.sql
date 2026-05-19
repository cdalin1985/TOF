-- Recovered from Supabase migration history (version 20260517213621).
-- Source: supabase_migrations.schema_migrations
-- Name: 013_release_readiness

-- ============================================================
-- TOC App - Migration 013: Release Readiness
-- ============================================================

-- 1. Replace legacy match payment method values.
ALTER TABLE public.matches DROP CONSTRAINT IF EXISTS matches_player1_payment_method_check;
ALTER TABLE public.matches DROP CONSTRAINT IF EXISTS matches_player2_payment_method_check;

UPDATE public.matches
SET player1_payment_method = CASE player1_payment_method
  WHEN 'envelope' THEN 'cash_envelope'
  WHEN 'digital' THEN NULL
  ELSE player1_payment_method
END
WHERE player1_payment_method IN ('envelope', 'digital');

UPDATE public.matches
SET player2_payment_method = CASE player2_payment_method
  WHEN 'envelope' THEN 'cash_envelope'
  WHEN 'digital' THEN NULL
  ELSE player2_payment_method
END
WHERE player2_payment_method IN ('envelope', 'digital');

ALTER TABLE public.matches
  ADD CONSTRAINT matches_player1_payment_method_check
  CHECK (
    player1_payment_method IS NULL
    OR player1_payment_method IN ('cash_envelope', 'paypal', 'cash_app', 'venmo')
  );

ALTER TABLE public.matches
  ADD CONSTRAINT matches_player2_payment_method_check
  CHECK (
    player2_payment_method IS NULL
    OR player2_payment_method IN ('cash_envelope', 'paypal', 'cash_app', 'venmo')
  );

-- 2. Track declined-challenge forfeits separately from played losses.
ALTER TABLE public.player_season_stats
  ADD COLUMN IF NOT EXISTS forfeits integer NOT NULL DEFAULT 0;

ALTER TABLE public.player_discipline_stats
  ADD COLUMN IF NOT EXISTS forfeits integer NOT NULL DEFAULT 0;

-- 3. Add idempotent source metadata to treasury rows.
ALTER TABLE public.treasury_ledger
  ADD COLUMN IF NOT EXISTS source_type text;

ALTER TABLE public.treasury_ledger
  ADD COLUMN IF NOT EXISTS source_id uuid;

ALTER TABLE public.treasury_ledger
  ADD COLUMN IF NOT EXISTS player_id uuid REFERENCES public.players(id);

ALTER TABLE public.treasury_ledger
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

UPDATE public.treasury_ledger
SET metadata = '{}'::jsonb
WHERE metadata IS NULL;

ALTER TABLE public.treasury_ledger
  ALTER COLUMN metadata SET DEFAULT '{}'::jsonb,
  ALTER COLUMN metadata SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS treasury_ledger_source_unique
  ON public.treasury_ledger(source_type, source_id, player_id)
  WHERE source_type IS NOT NULL
    AND source_id IS NOT NULL
    AND player_id IS NOT NULL;

-- 4. Shared treasury balance views.
CREATE OR REPLACE VIEW public.treasury_ledger_effects AS
SELECT
  ledger.id,
  ledger.entry_type,
  ledger.amount_cents,
  ledger.description,
  ledger.created_by,
  ledger.reversed_entry_id,
  ledger.source_type,
  ledger.source_id,
  ledger.player_id,
  ledger.metadata,
  ledger.created_at,
  CASE
    WHEN ledger.entry_type = 'credit' THEN ledger.amount_cents
    WHEN ledger.entry_type = 'debit' THEN -ledger.amount_cents
    WHEN ledger.entry_type = 'correction' THEN ledger.amount_cents
    WHEN ledger.entry_type = 'reversal' AND ledger.reversed_entry_id IS NOT NULL THEN
      -COALESCE(
        CASE
          WHEN reversed.entry_type = 'credit' THEN reversed.amount_cents
          WHEN reversed.entry_type = 'debit' THEN -reversed.amount_cents
          WHEN reversed.entry_type = 'correction' THEN reversed.amount_cents
          ELSE 0
        END,
        0
      )
    ELSE 0
  END AS effect_cents
FROM public.treasury_ledger ledger
LEFT JOIN public.treasury_ledger reversed ON reversed.id = ledger.reversed_entry_id;

CREATE OR REPLACE VIEW public.treasury_summary AS
SELECT
  COALESCE(SUM(GREATEST(effect_cents, 0)), 0)::bigint AS total_credit_cents,
  COALESCE(SUM(ABS(LEAST(effect_cents, 0))), 0)::bigint AS total_debit_cents,
  COALESCE(SUM(effect_cents), 0)::bigint AS balance_cents,
  COUNT(*)::bigint AS entry_count,
  MAX(created_at) AS last_entry_at
FROM public.treasury_ledger_effects;

GRANT SELECT ON public.treasury_ledger_effects TO anon, authenticated, service_role;
GRANT SELECT ON public.treasury_summary TO anon, authenticated, service_role;

-- 5. Store decline-forfeit side effects so accidental declines can be reversed safely.
CREATE TABLE IF NOT EXISTS public.challenge_forfeiture_events (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  challenge_id uuid NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  challenger_id uuid NOT NULL REFERENCES public.players(id),
  forfeiting_player_id uuid NOT NULL REFERENCES public.players(id),
  winner_id uuid NOT NULL REFERENCES public.players(id),
  loser_id uuid NOT NULL REFERENCES public.players(id),
  previous_challenge_status text NOT NULL,
  challenger_previous_position integer,
  forfeiting_previous_position integer,
  challenger_new_position integer,
  forfeiting_new_position integer,
  cooldown_id uuid REFERENCES public.cooldowns(id) ON DELETE SET NULL,
  activity_event_id uuid REFERENCES public.activity_feed(id) ON DELETE SET NULL,
  notification_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  reversed_at timestamptz,
  reversed_by_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE UNIQUE INDEX IF NOT EXISTS challenge_forfeiture_events_one_active_per_challenge
  ON public.challenge_forfeiture_events(challenge_id)
  WHERE reversed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_challenge_forfeiture_events_challenge
  ON public.challenge_forfeiture_events(challenge_id, created_at DESC);

ALTER TABLE public.challenge_forfeiture_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view challenge forfeiture events" ON public.challenge_forfeiture_events;
DROP POLICY IF EXISTS "Authenticated users can view challenge forfeiture events" ON public.challenge_forfeiture_events;
CREATE POLICY "Authenticated users can view challenge forfeiture events"
  ON public.challenge_forfeiture_events FOR SELECT
  TO authenticated
  USING (true);

REVOKE ALL ON TABLE public.challenge_forfeiture_events FROM anon;
GRANT SELECT ON public.challenge_forfeiture_events TO authenticated;
GRANT ALL ON public.challenge_forfeiture_events TO service_role;

-- 6. Apply a declined challenge as a forfeit.
CREATE OR REPLACE FUNCTION public.apply_challenge_decline_forfeit(
  p_challenge_id uuid,
  p_actor_profile_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_challenge public.challenges%ROWTYPE;
  v_event_id uuid;
  v_cooldown_id uuid;
  v_activity_event_id uuid;
  v_notification_ids uuid[] := '{}'::uuid[];
  v_challenger_previous_position integer;
  v_forfeiting_previous_position integer;
  v_challenger_new_position integer;
  v_forfeiting_new_position integer;
  v_challenger_name text;
  v_forfeiting_name text;
  v_challenger_rank1_since timestamptz;
  v_forfeiting_rank1_since timestamptz;
  v_cooldown_hours integer;
  v_challenger_season_before jsonb := '{}'::jsonb;
  v_forfeiting_season_before jsonb := '{}'::jsonb;
  v_challenger_discipline_before jsonb := '{}'::jsonb;
  v_forfeiting_discipline_before jsonb := '{}'::jsonb;
BEGIN
  LOCK TABLE public.rankings IN SHARE ROW EXCLUSIVE MODE;

  SELECT * INTO v_challenge FROM public.challenges WHERE id = p_challenge_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Challenge % not found', p_challenge_id; END IF;
  IF v_challenge.status <> 'pending' THEN
    RAISE EXCEPTION 'Challenge % is %, not pending', p_challenge_id, v_challenge.status;
  END IF;
  IF EXISTS (SELECT 1 FROM public.challenge_forfeiture_events WHERE challenge_id = p_challenge_id AND reversed_at IS NULL) THEN
    RAISE EXCEPTION 'Challenge % already has an active forfeit event', p_challenge_id;
  END IF;

  SELECT position, rank1_since INTO v_challenger_previous_position, v_challenger_rank1_since
  FROM public.rankings WHERE player_id = v_challenge.challenger_id;
  SELECT position, rank1_since INTO v_forfeiting_previous_position, v_forfeiting_rank1_since
  FROM public.rankings WHERE player_id = v_challenge.challenged_id;
  SELECT full_name INTO v_challenger_name FROM public.players WHERE id = v_challenge.challenger_id;
  SELECT full_name INTO v_forfeiting_name FROM public.players WHERE id = v_challenge.challenged_id;

  INSERT INTO public.player_season_stats(player_id)
  VALUES (v_challenge.challenger_id), (v_challenge.challenged_id)
  ON CONFLICT (player_id) DO NOTHING;

  INSERT INTO public.player_discipline_stats(player_id, discipline)
  VALUES (v_challenge.challenger_id, v_challenge.discipline), (v_challenge.challenged_id, v_challenge.discipline)
  ON CONFLICT (player_id, discipline) DO NOTHING;

  SELECT to_jsonb(stats) INTO v_challenger_season_before
  FROM public.player_season_stats stats WHERE stats.player_id = v_challenge.challenger_id;
  SELECT to_jsonb(stats) INTO v_forfeiting_season_before
  FROM public.player_season_stats stats WHERE stats.player_id = v_challenge.challenged_id;
  SELECT to_jsonb(stats) INTO v_challenger_discipline_before
  FROM public.player_discipline_stats stats
  WHERE stats.player_id = v_challenge.challenger_id AND stats.discipline = v_challenge.discipline;
  SELECT to_jsonb(stats) INTO v_forfeiting_discipline_before
  FROM public.player_discipline_stats stats
  WHERE stats.player_id = v_challenge.challenged_id AND stats.discipline = v_challenge.discipline;

  UPDATE public.challenges
  SET status = 'forfeited',
      response_message = COALESCE(response_message, 'Declined challenge counted as a forfeit.'),
      updated_at = now()
  WHERE id = p_challenge_id;

  IF v_challenger_previous_position IS NOT NULL AND v_forfeiting_previous_position IS NOT NULL
     AND v_challenger_previous_position > v_forfeiting_previous_position THEN
    PERFORM public.cascade_ranking_after_win(v_challenge.challenger_id, v_challenge.challenged_id);
  END IF;

  SELECT position INTO v_challenger_new_position FROM public.rankings WHERE player_id = v_challenge.challenger_id;
  SELECT position INTO v_forfeiting_new_position FROM public.rankings WHERE player_id = v_challenge.challenged_id;

  UPDATE public.player_season_stats
  SET wins = wins + 1, forfeit_wins = forfeit_wins + 1, challenger_wins = challenger_wins + 1,
      current_streak = CASE WHEN current_streak >= 0 THEN current_streak + 1 ELSE 1 END,
      best_streak = GREATEST(best_streak, CASE WHEN current_streak >= 0 THEN current_streak + 1 ELSE 1 END),
      best_rank_achieved = CASE
        WHEN v_challenger_new_position IS NULL THEN best_rank_achieved
        WHEN best_rank_achieved IS NULL OR v_challenger_new_position < best_rank_achieved THEN v_challenger_new_position
        ELSE best_rank_achieved END,
      updated_at = now()
  WHERE player_id = v_challenge.challenger_id;

  UPDATE public.player_season_stats
  SET forfeits = forfeits + 1, current_streak = 0, updated_at = now()
  WHERE player_id = v_challenge.challenged_id;

  UPDATE public.player_discipline_stats
  SET wins = wins + 1, forfeit_wins = forfeit_wins + 1, challenger_wins = challenger_wins + 1,
      current_streak = CASE WHEN current_streak >= 0 THEN current_streak + 1 ELSE 1 END,
      best_streak = GREATEST(best_streak, CASE WHEN current_streak >= 0 THEN current_streak + 1 ELSE 1 END),
      updated_at = now()
  WHERE player_id = v_challenge.challenger_id AND discipline = v_challenge.discipline;

  UPDATE public.player_discipline_stats
  SET forfeits = forfeits + 1, current_streak = 0, updated_at = now()
  WHERE player_id = v_challenge.challenged_id AND discipline = v_challenge.discipline;

  SELECT cooldown_hours INTO v_cooldown_hours FROM public.league_settings LIMIT 1;
  v_cooldown_hours := COALESCE(v_cooldown_hours, 24);
  IF v_cooldown_hours > 0 THEN
    INSERT INTO public.cooldowns(player_id, type, expires_at)
    VALUES (v_challenge.challenged_id, 'post_match', now() + make_interval(hours => v_cooldown_hours))
    RETURNING id INTO v_cooldown_id;
  END IF;

  INSERT INTO public.activity_feed(event_type, headline, detail, actor_player_id)
  VALUES (
    'challenge_forfeited',
    COALESCE(v_challenger_name, 'Challenger') || ' won by forfeit after ' ||
      COALESCE(v_forfeiting_name, 'the challenged player') || ' declined the challenge.',
    'Discipline: ' || v_challenge.discipline || '. Race to ' || v_challenge.race_length ||
      '. Ranking moved from #' || COALESCE(v_challenger_previous_position::text, '?') ||
      ' vs #' || COALESCE(v_forfeiting_previous_position::text, '?') ||
      ' to #' || COALESCE(v_challenger_new_position::text, '?') ||
      ' vs #' || COALESCE(v_forfeiting_new_position::text, '?') ||
      '. No match fee was charged.',
    v_challenge.challenged_id
  )
  RETURNING id INTO v_activity_event_id;

  WITH inserted_notifications AS (
    INSERT INTO public.notifications(player_id, type, title, body, reference_id, reference_type)
    VALUES
      (v_challenge.challenger_id, 'challenge_forfeit_win', 'Challenge won by forfeit',
        COALESCE(v_forfeiting_name, 'Your opponent') || ' declined your ' || v_challenge.discipline ||
        ' challenge. Your record and ranking have been updated.', p_challenge_id, 'challenge'),
      (v_challenge.challenged_id, 'challenge_forfeited', 'Challenge declined as forfeit',
        'Declining ' || COALESCE(v_challenger_name, 'the challenger') || '''s ' || v_challenge.discipline ||
        ' challenge was recorded as a forfeit. No match fee was charged.', p_challenge_id, 'challenge')
    RETURNING id
  )
  SELECT COALESCE(array_agg(id), '{}'::uuid[]) INTO v_notification_ids FROM inserted_notifications;

  INSERT INTO public.audit_events(actor_profile_id, action, target_type, target_id, detail)
  VALUES (p_actor_profile_id, 'challenge_decline_forfeit_applied', 'challenge', p_challenge_id,
    jsonb_build_object(
      'challenger_id', v_challenge.challenger_id,
      'forfeiting_player_id', v_challenge.challenged_id,
      'challenger_previous_position', v_challenger_previous_position,
      'forfeiting_previous_position', v_forfeiting_previous_position,
      'challenger_new_position', v_challenger_new_position,
      'forfeiting_new_position', v_forfeiting_new_position,
      'cooldown_id', v_cooldown_id,
      'activity_event_id', v_activity_event_id,
      'notification_ids', v_notification_ids
    ));

  INSERT INTO public.challenge_forfeiture_events(
    challenge_id, challenger_id, forfeiting_player_id, winner_id, loser_id,
    previous_challenge_status, challenger_previous_position, forfeiting_previous_position,
    challenger_new_position, forfeiting_new_position, cooldown_id, activity_event_id,
    notification_ids, metadata
  )
  VALUES (
    p_challenge_id, v_challenge.challenger_id, v_challenge.challenged_id,
    v_challenge.challenger_id, v_challenge.challenged_id, v_challenge.status,
    v_challenger_previous_position, v_forfeiting_previous_position,
    v_challenger_new_position, v_forfeiting_new_position,
    v_cooldown_id, v_activity_event_id, v_notification_ids,
    jsonb_build_object(
      'actor_profile_id', p_actor_profile_id,
      'discipline', v_challenge.discipline,
      'race_length', v_challenge.race_length,
      'previous_response_message', v_challenge.response_message,
      'challenger_rank1_since_before', v_challenger_rank1_since,
      'forfeiting_rank1_since_before', v_forfeiting_rank1_since,
      'challenger_season_before', v_challenger_season_before,
      'forfeiting_season_before', v_forfeiting_season_before,
      'challenger_discipline_before', v_challenger_discipline_before,
      'forfeiting_discipline_before', v_forfeiting_discipline_before
    ))
  RETURNING id INTO v_event_id;

  RETURN v_event_id;
END;
$$;

-- 7. Reverse an accidental declined-challenge forfeit.
CREATE OR REPLACE FUNCTION public.reverse_challenge_decline_forfeit(
  p_challenge_id uuid,
  p_actor_profile_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_challenge public.challenges%ROWTYPE;
  v_event public.challenge_forfeiture_events%ROWTYPE;
  v_challenger_current_position integer;
  v_forfeiting_current_position integer;
  v_challenger_name text;
  v_forfeiting_name text;
  v_reversal_activity_event_id uuid;
  v_reversal_notification_ids uuid[] := '{}'::uuid[];
  v_challenger_season_before jsonb;
  v_forfeiting_season_before jsonb;
  v_challenger_discipline_before jsonb;
  v_forfeiting_discipline_before jsonb;
  v_expected_challenger_season_streak integer;
  v_expected_challenger_discipline_streak integer;
  v_expected_challenger_best_rank integer;
BEGIN
  IF p_actor_profile_id IS NULL THEN
    RAISE EXCEPTION 'Actor profile id is required to reverse a forfeit';
  END IF;

  LOCK TABLE public.rankings IN SHARE ROW EXCLUSIVE MODE;

  SELECT * INTO v_event FROM public.challenge_forfeiture_events
  WHERE challenge_id = p_challenge_id AND reversed_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Challenge % has no active forfeit event to reverse', p_challenge_id;
  END IF;

  SELECT * INTO v_challenge FROM public.challenges WHERE id = p_challenge_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Challenge % not found while reversing forfeit', p_challenge_id;
  END IF;

  IF v_challenge.status <> 'forfeited'
     OR v_challenge.challenger_id <> v_event.challenger_id
     OR v_challenge.challenged_id <> v_event.forfeiting_player_id
     OR v_challenge.response_message IS DISTINCT FROM COALESCE(
       v_event.metadata->>'previous_response_message',
       'Declined challenge counted as a forfeit.'
     ) THEN
    RAISE EXCEPTION 'Cannot automatically reverse challenge %, challenge row changed after the forfeit', p_challenge_id;
  END IF;

  SELECT position INTO v_challenger_current_position FROM public.rankings WHERE player_id = v_event.challenger_id;
  SELECT position INTO v_forfeiting_current_position FROM public.rankings WHERE player_id = v_event.forfeiting_player_id;

  IF v_challenger_current_position IS DISTINCT FROM v_event.challenger_new_position
     OR v_forfeiting_current_position IS DISTINCT FROM v_event.forfeiting_new_position THEN
    RAISE EXCEPTION 'Cannot automatically reverse challenge %, rankings changed after the forfeit', p_challenge_id;
  END IF;

  v_challenger_season_before := v_event.metadata->'challenger_season_before';
  v_forfeiting_season_before := v_event.metadata->'forfeiting_season_before';
  v_challenger_discipline_before := v_event.metadata->'challenger_discipline_before';
  v_forfeiting_discipline_before := v_event.metadata->'forfeiting_discipline_before';

  IF v_challenger_season_before IS NULL OR v_forfeiting_season_before IS NULL
     OR v_challenger_discipline_before IS NULL OR v_forfeiting_discipline_before IS NULL THEN
    RAISE EXCEPTION 'Cannot automatically reverse challenge %, forfeit stat snapshots are missing', p_challenge_id;
  END IF;

  v_expected_challenger_season_streak := CASE
    WHEN (v_challenger_season_before->>'current_streak')::integer >= 0
    THEN (v_challenger_season_before->>'current_streak')::integer + 1 ELSE 1 END;
  v_expected_challenger_discipline_streak := CASE
    WHEN (v_challenger_discipline_before->>'current_streak')::integer >= 0
    THEN (v_challenger_discipline_before->>'current_streak')::integer + 1 ELSE 1 END;
  v_expected_challenger_best_rank := CASE
    WHEN v_event.challenger_new_position IS NULL THEN (v_challenger_season_before->>'best_rank_achieved')::integer
    WHEN (v_challenger_season_before->>'best_rank_achieved')::integer IS NULL THEN v_event.challenger_new_position
    WHEN v_event.challenger_new_position < (v_challenger_season_before->>'best_rank_achieved')::integer THEN v_event.challenger_new_position
    ELSE (v_challenger_season_before->>'best_rank_achieved')::integer END;

  IF NOT EXISTS (
    SELECT 1 FROM public.player_season_stats WHERE player_id = v_event.challenger_id
      AND wins IS NOT DISTINCT FROM (v_challenger_season_before->>'wins')::integer + 1
      AND forfeit_wins IS NOT DISTINCT FROM (v_challenger_season_before->>'forfeit_wins')::integer + 1
      AND challenger_wins IS NOT DISTINCT FROM (v_challenger_season_before->>'challenger_wins')::integer + 1
      AND current_streak IS NOT DISTINCT FROM v_expected_challenger_season_streak
      AND best_streak IS NOT DISTINCT FROM GREATEST((v_challenger_season_before->>'best_streak')::integer, v_expected_challenger_season_streak)
      AND best_rank_achieved IS NOT DISTINCT FROM v_expected_challenger_best_rank
  ) THEN RAISE EXCEPTION 'Cannot automatically reverse challenge %, challenger season stats changed after the forfeit', p_challenge_id;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.player_season_stats WHERE player_id = v_event.forfeiting_player_id
      AND forfeits IS NOT DISTINCT FROM (v_forfeiting_season_before->>'forfeits')::integer + 1
      AND current_streak IS NOT DISTINCT FROM 0
  ) THEN RAISE EXCEPTION 'Cannot automatically reverse challenge %, forfeiting player season stats changed after the forfeit', p_challenge_id;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.player_discipline_stats WHERE player_id = v_event.challenger_id
      AND discipline = v_event.metadata->>'discipline'
      AND wins IS NOT DISTINCT FROM (v_challenger_discipline_before->>'wins')::integer + 1
      AND forfeit_wins IS NOT DISTINCT FROM (v_challenger_discipline_before->>'forfeit_wins')::integer + 1
      AND challenger_wins IS NOT DISTINCT FROM (v_challenger_discipline_before->>'challenger_wins')::integer + 1
      AND current_streak IS NOT DISTINCT FROM v_expected_challenger_discipline_streak
      AND best_streak IS NOT DISTINCT FROM GREATEST((v_challenger_discipline_before->>'best_streak')::integer, v_expected_challenger_discipline_streak)
  ) THEN RAISE EXCEPTION 'Cannot automatically reverse challenge %, challenger discipline stats changed after the forfeit', p_challenge_id;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.player_discipline_stats WHERE player_id = v_event.forfeiting_player_id
      AND discipline = v_event.metadata->>'discipline'
      AND forfeits IS NOT DISTINCT FROM (v_forfeiting_discipline_before->>'forfeits')::integer + 1
      AND current_streak IS NOT DISTINCT FROM 0
  ) THEN RAISE EXCEPTION 'Cannot automatically reverse challenge %, forfeiting player discipline stats changed after the forfeit', p_challenge_id;
  END IF;

  IF v_event.challenger_previous_position IS NOT NULL AND v_event.challenger_new_position IS NOT NULL
     AND v_event.challenger_previous_position <> v_event.challenger_new_position THEN
    UPDATE public.rankings SET previous_position = position, position = position + 1000, updated_at = now()
    WHERE position BETWEEN v_event.challenger_new_position AND v_event.challenger_previous_position;

    UPDATE public.rankings
    SET previous_position = v_event.challenger_new_position, position = v_event.challenger_previous_position,
        rank1_since = (v_event.metadata->>'challenger_rank1_since_before')::timestamptz, updated_at = now()
    WHERE player_id = v_event.challenger_id;

    UPDATE public.rankings SET position = position - 1001, updated_at = now()
    WHERE position BETWEEN (1000 + v_event.challenger_new_position + 1) AND (1000 + v_event.challenger_previous_position);

    UPDATE public.rankings
    SET rank1_since = (v_event.metadata->>'forfeiting_rank1_since_before')::timestamptz, updated_at = now()
    WHERE player_id = v_event.forfeiting_player_id;
  END IF;

  UPDATE public.challenges
  SET status = v_event.previous_challenge_status,
      response_message = v_event.metadata->>'previous_response_message', updated_at = now()
  WHERE id = p_challenge_id;

  IF v_event.cooldown_id IS NOT NULL THEN
    DELETE FROM public.cooldowns WHERE id = v_event.cooldown_id;
  END IF;

  UPDATE public.player_season_stats
  SET wins = (v_challenger_season_before->>'wins')::integer,
      forfeit_wins = (v_challenger_season_before->>'forfeit_wins')::integer,
      challenger_wins = (v_challenger_season_before->>'challenger_wins')::integer,
      current_streak = (v_challenger_season_before->>'current_streak')::integer,
      best_streak = (v_challenger_season_before->>'best_streak')::integer,
      best_rank_achieved = (v_challenger_season_before->>'best_rank_achieved')::integer,
      updated_at = now()
  WHERE player_id = v_event.challenger_id;

  UPDATE public.player_season_stats
  SET forfeits = (v_forfeiting_season_before->>'forfeits')::integer,
      current_streak = (v_forfeiting_season_before->>'current_streak')::integer, updated_at = now()
  WHERE player_id = v_event.forfeiting_player_id;

  UPDATE public.player_discipline_stats
  SET wins = (v_challenger_discipline_before->>'wins')::integer,
      forfeit_wins = (v_challenger_discipline_before->>'forfeit_wins')::integer,
      challenger_wins = (v_challenger_discipline_before->>'challenger_wins')::integer,
      current_streak = (v_challenger_discipline_before->>'current_streak')::integer,
      best_streak = (v_challenger_discipline_before->>'best_streak')::integer, updated_at = now()
  WHERE player_id = v_event.challenger_id AND discipline = v_event.metadata->>'discipline';

  UPDATE public.player_discipline_stats
  SET forfeits = (v_forfeiting_discipline_before->>'forfeits')::integer,
      current_streak = (v_forfeiting_discipline_before->>'current_streak')::integer, updated_at = now()
  WHERE player_id = v_event.forfeiting_player_id AND discipline = v_event.metadata->>'discipline';

  SELECT full_name INTO v_challenger_name FROM public.players WHERE id = v_event.challenger_id;
  SELECT full_name INTO v_forfeiting_name FROM public.players WHERE id = v_event.forfeiting_player_id;

  INSERT INTO public.activity_feed(event_type, headline, detail, actor_player_id)
  VALUES ('challenge_forfeit_reversed',
    'Accidental decline reversed for ' || COALESCE(v_challenger_name, 'the challenger') ||
      ' vs ' || COALESCE(v_forfeiting_name, 'the challenged player') || '.',
    'The challenge is pending again. Forfeit stats, cooldown, and immediate ranking movement were reversed by an admin.',
    v_event.forfeiting_player_id)
  RETURNING id INTO v_reversal_activity_event_id;

  WITH inserted_notifications AS (
    INSERT INTO public.notifications(player_id, type, title, body, reference_id, reference_type)
    VALUES
      (v_event.challenger_id, 'challenge_forfeit_reversed', 'Decline reversed',
        'An admin reversed the accidental decline. Your challenge against ' ||
        COALESCE(v_forfeiting_name, 'the challenged player') || ' is pending again.',
        p_challenge_id, 'challenge'),
      (v_event.forfeiting_player_id, 'challenge_forfeit_reversed', 'Decline reversed',
        'An admin reversed the accidental decline. ' ||
        COALESCE(v_challenger_name, 'The challenger') || '''s challenge is pending again.',
        p_challenge_id, 'challenge')
    RETURNING id
  )
  SELECT COALESCE(array_agg(id), '{}'::uuid[]) INTO v_reversal_notification_ids FROM inserted_notifications;

  UPDATE public.challenge_forfeiture_events
  SET reversed_at = now(), reversed_by_profile_id = p_actor_profile_id,
      metadata = metadata || jsonb_build_object(
        'reversal_activity_event_id', v_reversal_activity_event_id,
        'reversal_notification_ids', v_reversal_notification_ids)
  WHERE id = v_event.id;

  INSERT INTO public.audit_events(actor_profile_id, action, target_type, target_id, detail)
  VALUES (p_actor_profile_id, 'challenge_decline_forfeit_reversed', 'challenge', p_challenge_id,
    jsonb_build_object(
      'forfeiture_event_id', v_event.id,
      'challenger_id', v_event.challenger_id,
      'forfeiting_player_id', v_event.forfeiting_player_id,
      'reversal_activity_event_id', v_reversal_activity_event_id,
      'reversal_notification_ids', v_reversal_notification_ids
    ));
END;
$$;

REVOKE ALL ON FUNCTION public.apply_challenge_decline_forfeit(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.apply_challenge_decline_forfeit(uuid, uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_challenge_decline_forfeit(uuid, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.reverse_challenge_decline_forfeit(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reverse_challenge_decline_forfeit(uuid, uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reverse_challenge_decline_forfeit(uuid, uuid) TO service_role;
