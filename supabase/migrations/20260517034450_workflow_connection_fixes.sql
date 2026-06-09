-- Recovered from Supabase migration history (version 20260517034450).
-- Source: supabase_migrations.schema_migrations
-- Name: workflow_connection_fixes

-- ============================================================
-- TOC App - Migration 010: Workflow Connection Fixes
-- ============================================================
-- Source of truth project: toc1 / ankvjywsnydpkepdvuvm
--
-- Fixes confirmed live drift:
-- - Rank #1 cron was running old penalty SQL that violates rankings.position.
-- - Ranking cascades moved rows directly through unique positions.
-- - submit-result uses an internal matches.status='confirming' lock.
-- - max_race=15 contradicted the current "no maximum" race rule.
-- - Sensitive rank helper RPCs were executable outside service_role.

-- Race length canon: min 6, no maximum. NULL max_race means no cap.
ALTER TABLE public.league_settings
  ALTER COLUMN max_race DROP NOT NULL;

UPDATE public.league_settings
SET max_race = NULL;

-- submit-result atomically claims a submitted match by moving it through this
-- short-lived internal state before confirming the result.
ALTER TABLE public.matches DROP CONSTRAINT IF EXISTS matches_status_check;
ALTER TABLE public.matches ADD CONSTRAINT matches_status_check CHECK (status = ANY (ARRAY[
  'scheduled'::text,
  'in_progress'::text,
  'submitted'::text,
  'confirming'::text,
  'confirmed'::text,
  'disputed'::text,
  'resolved'::text
]));

-- Replace the older Rank #1 helper before changing apply_rank1_penalty's
-- return type. A compatibility wrapper is recreated below.
DROP FUNCTION IF EXISTS public.check_and_enforce_rank1_obligation();
DROP FUNCTION IF EXISTS public.apply_rank1_penalty(uuid);

CREATE OR REPLACE FUNCTION public.cascade_ranking_after_win(p_winner_id uuid, p_loser_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_winner_pos integer;
  v_loser_pos integer;
BEGIN
  LOCK TABLE public.rankings IN ROW EXCLUSIVE MODE;

  SELECT position INTO v_winner_pos
  FROM public.rankings
  WHERE player_id = p_winner_id;

  SELECT position INTO v_loser_pos
  FROM public.rankings
  WHERE player_id = p_loser_id;

  IF v_winner_pos IS NULL OR v_loser_pos IS NULL OR v_winner_pos <= v_loser_pos THEN
    RETURN;
  END IF;

  -- Move all affected ranks out of the unique position range first.
  UPDATE public.rankings
  SET
    previous_position = position,
    position = position + 1000,
    updated_at = now()
  WHERE position BETWEEN v_loser_pos AND v_winner_pos;

  UPDATE public.rankings
  SET
    previous_position = v_winner_pos,
    position = v_loser_pos,
    updated_at = now(),
    rank1_since = CASE WHEN v_loser_pos = 1 THEN now() ELSE rank1_since END
  WHERE player_id = p_winner_id;

  UPDATE public.rankings
  SET
    position = position - 999,
    updated_at = now(),
    rank1_since = CASE WHEN position - 1000 = 1 THEN NULL ELSE rank1_since END
  WHERE position BETWEEN (1000 + v_loser_pos) AND (1000 + v_winner_pos - 1);
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_rank1_penalty(p_player_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_position integer;
  v_target_rank integer;
BEGIN
  LOCK TABLE public.rankings IN ROW EXCLUSIVE MODE;

  SELECT position
  INTO v_current_position
  FROM public.rankings
  WHERE player_id = p_player_id;

  IF v_current_position IS DISTINCT FROM 1 THEN
    RETURN NULL;
  END IF;

  SELECT least(10, max(position))
  INTO v_target_rank
  FROM public.rankings;

  IF v_target_rank IS NULL OR v_target_rank <= 1 THEN
    RETURN NULL;
  END IF;

  UPDATE public.rankings
  SET
    previous_position = position,
    position = position + 1000,
    updated_at = now()
  WHERE position BETWEEN 2 AND v_target_rank;

  UPDATE public.rankings
  SET
    previous_position = 1,
    position = v_target_rank,
    updated_at = now(),
    rank1_since = NULL
  WHERE player_id = p_player_id;

  UPDATE public.rankings
  SET
    position = position - 1001,
    updated_at = now(),
    rank1_since = CASE WHEN position - 1001 = 1 THEN now() ELSE rank1_since END
  WHERE position BETWEEN 1002 AND 1000 + v_target_rank;

  RETURN v_target_rank;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_rank1_obligations()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rank1 record;
  v_rank1_name text;
  v_top5_player_ids uuid[];
  v_top5_match_count integer := 0;
  v_days_elapsed integer;
  v_target_rank integer;
BEGIN
  SELECT
    r.player_id,
    r.position,
    r.rank1_since,
    p.full_name
  INTO v_rank1
  FROM public.rankings r
  JOIN public.players p ON p.id = r.player_id
  WHERE r.position = 1
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  v_rank1_name := coalesce(v_rank1.full_name, 'Rank #1 player');

  IF v_rank1.rank1_since IS NULL THEN
    UPDATE public.rankings
    SET rank1_since = now(),
        updated_at = now()
    WHERE player_id = v_rank1.player_id;

    INSERT INTO public.audit_events(action, target_type, target_id, detail)
    VALUES (
      'rank1_since_initialized',
      'player',
      v_rank1.player_id,
      jsonb_build_object('reason', 'rank1_since was null during automated enforcement')
    );

    RETURN;
  END IF;

  v_days_elapsed := floor(extract(epoch FROM (now() - v_rank1.rank1_since)) / 86400)::integer;

  SELECT coalesce(array_agg(player_id), ARRAY[]::uuid[])
  INTO v_top5_player_ids
  FROM public.rankings
  WHERE position BETWEEN 2 AND 5;

  IF cardinality(v_top5_player_ids) > 0 THEN
    SELECT count(*)::integer
    INTO v_top5_match_count
    FROM public.matches m
    WHERE m.status = 'confirmed'
      AND m.completed_at >= v_rank1.rank1_since
      AND (
        (m.player1_id = v_rank1.player_id AND m.player2_id = ANY(v_top5_player_ids))
        OR (m.player2_id = v_rank1.player_id AND m.player1_id = ANY(v_top5_player_ids))
      );
  END IF;

  IF v_top5_match_count >= 2 THEN
    UPDATE public.rankings
    SET rank1_since = now(),
        updated_at = now()
    WHERE player_id = v_rank1.player_id;
    RETURN;
  END IF;

  IF v_days_elapsed < 30 THEN
    RETURN;
  END IF;

  SELECT public.apply_rank1_penalty(v_rank1.player_id)
  INTO v_target_rank;

  IF v_target_rank IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.audit_events(action, target_type, target_id, detail)
  VALUES (
    'rank1_auto_demoted',
    'player',
    v_rank1.player_id,
    jsonb_build_object(
      'from_position', 1,
      'to_position', v_target_rank,
      'top5_matches', v_top5_match_count,
      'days_elapsed', v_days_elapsed,
      'reason', 'Rank #1 did not complete 2 top-5 matches within 30 days',
      'ran_at', now()
    )
  );

  INSERT INTO public.notifications(player_id, type, title, body, reference_type)
  VALUES (
    v_rank1.player_id,
    'rank1_penalty',
    'Rank 1 obligation not met',
    'You did not play a top-5 opponent twice in your 30-day window. You have been moved to #' || v_target_rank || '.',
    'ranking'
  );

  INSERT INTO public.activity_feed(event_type, headline, detail, actor_player_id)
  VALUES (
    'rank1_penalty',
    v_rank1_name || ' was moved to #' || v_target_rank || ' for failing the #1 top-5 obligation.',
    'Rank #1 obligation enforced automatically by cron.',
    v_rank1.player_id
  );
END;
$$;

-- Backward-compatible service-only wrapper for any old job/manual caller.
CREATE OR REPLACE FUNCTION public.check_and_enforce_rank1_obligation()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.enforce_rank1_obligations();
  RETURN jsonb_build_object('action', 'delegated_to_enforce_rank1_obligations', 'at', now());
END;
$$;

REVOKE ALL ON FUNCTION public.cascade_ranking_after_win(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.apply_rank1_penalty(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enforce_rank1_obligations() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.check_and_enforce_rank1_obligation() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.expire_stale_challenges() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.cascade_ranking_after_win(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.apply_rank1_penalty(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.enforce_rank1_obligations() TO service_role;
GRANT EXECUTE ON FUNCTION public.check_and_enforce_rank1_obligation() TO service_role;
GRANT EXECUTE ON FUNCTION public.expire_stale_challenges() TO service_role;

DROP POLICY IF EXISTS "Anyone can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING ((select auth.uid()) = id);

-- Schedule Rank #1 enforcement only when pg_cron is available on the project.
-- New customer projects may not expose the cron schema by default, so this
-- block must be safe to run during a clean white-label bootstrap.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'cron') THEN
    EXECUTE $cron$
      SELECT cron.unschedule(jobid)
      FROM cron.job
      WHERE jobname = 'rank1-obligation-daily'
    $cron$;

    EXECUTE $cron$
      SELECT cron.schedule(
        'rank1-obligation-daily',
        '0 9 * * *',
        'SELECT public.enforce_rank1_obligations();'
      )
    $cron$;
  END IF;
END
$$;
