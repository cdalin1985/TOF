-- Recovered from Supabase migration history (version 20260513130537).
-- Source: supabase_migrations.schema_migrations
-- Name: 010_auto_enforce_rank1_obligation

-- Auto-enforce the rank-1 obligation.
--
-- The #1 player must play two top-5 opponents within 30 days of becoming #1
-- or be moved to #10. Until now this was a manual button (Enforce Now) — and
-- a buggy "Check Status" path that silently triggered it as a side effect.
-- Both of those have been fixed; now this is the durable, no-human-required
-- enforcement path that runs on a schedule.
--
-- The function is safe to call repeatedly. On each run it does at most ONE
-- thing:
--   1. If there's no #1 player, no-op.
--   2. If the #1 player's rank1_since is NULL, initialize it to NOW.
--   3. If they're within 30 days, no-op.
--   4. If they're past 30 days AND have ≥2 confirmed top-5 matches, no-op.
--   5. Otherwise: demote them via apply_rank1_penalty, write a notification,
--      write an activity-feed entry, and start the new #1's 30-day clock.
--
-- It returns a JSON blob describing what it did. Useful for the cron job's
-- log output, useful for manually invoking via SELECT to test.

CREATE OR REPLACE FUNCTION public.check_and_enforce_rank1_obligation()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rank1_player_id  uuid;
  v_rank1_since      timestamptz;
  v_match_count      integer;
  v_days_since       numeric;
  v_rank1_name       text;
  v_new_rank1_id     uuid;
BEGIN
  -- 1. Find the current #1.
  SELECT player_id, rank1_since
    INTO v_rank1_player_id, v_rank1_since
    FROM rankings
   WHERE position = 1;

  IF v_rank1_player_id IS NULL THEN
    RETURN jsonb_build_object('action', 'no_rank1', 'at', NOW());
  END IF;

  -- 2. Initialize rank1_since if it's missing. (Happens immediately after
  --    a cascade if the new #1 had a NULL value.)
  IF v_rank1_since IS NULL THEN
    UPDATE rankings SET rank1_since = NOW() WHERE player_id = v_rank1_player_id;
    RETURN jsonb_build_object(
      'action', 'initialized_rank1_since',
      'player_id', v_rank1_player_id,
      'at', NOW()
    );
  END IF;

  -- 3. Within the 30-day window — nothing to enforce.
  v_days_since := EXTRACT(EPOCH FROM (NOW() - v_rank1_since)) / 86400.0;

  IF v_days_since < 30 THEN
    RETURN jsonb_build_object(
      'action', 'within_window',
      'player_id', v_rank1_player_id,
      'days_at_top', round(v_days_since, 2)
    );
  END IF;

  -- 4. Count confirmed top-5 matches (#1 vs #2..#5) since they became #1.
  SELECT COUNT(*)
    INTO v_match_count
    FROM matches m
   WHERE m.status = 'confirmed'
     AND m.completed_at >= v_rank1_since
     AND (
       (m.player1_id = v_rank1_player_id AND m.player2_id IN (
         SELECT player_id FROM rankings WHERE position BETWEEN 2 AND 5
       ))
       OR
       (m.player2_id = v_rank1_player_id AND m.player1_id IN (
         SELECT player_id FROM rankings WHERE position BETWEEN 2 AND 5
       ))
     );

  IF v_match_count >= 2 THEN
    RETURN jsonb_build_object(
      'action', 'compliant',
      'player_id', v_rank1_player_id,
      'top5_matches', v_match_count,
      'days_at_top', round(v_days_since, 2)
    );
  END IF;

  -- 5. Not compliant — apply the penalty.
  SELECT full_name INTO v_rank1_name FROM players WHERE id = v_rank1_player_id;

  PERFORM public.apply_rank1_penalty(v_rank1_player_id);

  -- Notification to the demoted player.
  INSERT INTO notifications (player_id, type, title, body, reference_type)
  VALUES (
    v_rank1_player_id,
    'rank1_penalty',
    '📉 Rank 1 obligation not met',
    'You did not play a top-5 opponent twice in your 30-day window. You have been moved to #10.',
    'ranking'
  );

  -- Activity feed entry.
  INSERT INTO activity_feed (event_type, headline, actor_player_id)
  VALUES (
    'rank1_penalty',
    v_rank1_name || ' was moved to #10 for failing the #1 top-5 obligation.',
    v_rank1_player_id
  );

  -- Start the new #1's 30-day clock from NOW.
  SELECT player_id INTO v_new_rank1_id FROM rankings WHERE position = 1;
  UPDATE rankings SET rank1_since = NOW() WHERE player_id = v_new_rank1_id;

  RETURN jsonb_build_object(
    'action', 'penalized',
    'demoted_player_id', v_rank1_player_id,
    'demoted_player_name', v_rank1_name,
    'days_at_top', round(v_days_since, 2),
    'top5_matches', v_match_count,
    'new_rank1_id', v_new_rank1_id,
    'at', NOW()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_and_enforce_rank1_obligation() TO service_role;

COMMENT ON FUNCTION public.check_and_enforce_rank1_obligation() IS
  'Idempotent rank-1 obligation enforcer. On each call: initializes rank1_since if missing, demotes the #1 player if they have <2 top-5 confirmed matches and >=30 days at the top, and starts the new #1''s clock. Returns a jsonb blob describing the action taken. Scheduled via pg_cron daily at 12:00 UTC.';

-- Cron scheduling intentionally skipped during TOF bootstrap; enable pg_cron later after extension availability is verified.
