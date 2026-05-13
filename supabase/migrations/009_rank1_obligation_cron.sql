-- ============================================================
-- TOC App — Migration 009: Rank #1 Obligation Automation
-- ============================================================
-- Source of truth project: toc1 / ankvjywsnydpkepdvuvm
-- Runs twice daily at 00:00 and 12:00 UTC (6am and 6pm Mountain during MDT).
-- Idempotent: re-running this migration replaces the same cron job name.

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

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

  -- Move the affected ranks out of the way first so the unique position
  -- constraint is never violated while we cascade everyone upward.
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
  /*
    Rule:
    - Rank #1 must play at least 2 confirmed matches against current top-5
      opponents within 30 days of reaching #1.
    - If they are overdue and below the requirement, move them to #10, or to
      the bottom if the list has fewer than 10 players.
    - If rank1_since is missing, initialize it instead of punishing immediately.
  */
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
    '📉 Rank 1 obligation not met',
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

REVOKE ALL ON FUNCTION public.apply_rank1_penalty(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enforce_rank1_obligations() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_rank1_penalty(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.enforce_rank1_obligations() TO service_role;

-- Replace any previous Rank #1 cron job with the intended twice-daily schedule.
SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname IN ('rank1-obligation-check', 'toc_rank1_obligation_enforcement');

SELECT cron.schedule(
  'rank1-obligation-check',
  '0 0,12 * * *',
  $$SELECT public.enforce_rank1_obligations();$$
);
