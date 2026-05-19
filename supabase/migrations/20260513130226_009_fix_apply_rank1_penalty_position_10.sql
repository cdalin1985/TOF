-- Recovered from Supabase migration history (version 20260513130226).
-- Source: supabase_migrations.schema_migrations
-- Name: 009_fix_apply_rank1_penalty_position_10

-- Fix the apply_rank1_penalty function.
--
-- The old version's WHERE clause was: position >= 2 AND position <= 9
-- That excluded the row currently at position 10, so when the CASE tried to
-- assign position=10 to the penalized player, the UNIQUE(position) constraint
-- would silently fail (the player at position 10 wasn't being shuffled out
-- of the way). When the calling code didn't check the rpc error, the
-- function's caller proceeded to log an activity_feed entry as if the
-- demotion had succeeded — leaving a misleading record while the rankings
-- table stayed unchanged.
--
-- The fix: include position 10 in the WHERE. The CASE expression assigns
-- (position - 1) to it, moving the previous #10 to #9 — which is the correct
-- cascade. Postgres evaluates the entire CASE on each row's *original*
-- values before writing any of them back, so no transient duplicate-position
-- state exists and UNIQUE is satisfied.

CREATE OR REPLACE FUNCTION public.apply_rank1_penalty(p_player_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE rankings
  SET
    previous_position = position,
    position = CASE
      WHEN player_id = p_player_id THEN 10
      ELSE position - 1
    END,
    updated_at = NOW()
  WHERE player_id = p_player_id
     OR (position >= 2 AND position <= 10);

  UPDATE rankings
  SET rank1_since = NULL
  WHERE player_id = p_player_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_rank1_penalty(uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.apply_rank1_penalty(uuid) IS
  'Demote a player from #1 to #10 and cascade #2..#10 up by 1. Atomic single-UPDATE-with-CASE so the UNIQUE(position) constraint never sees overlap. Returns void; callers should check the SQL error.';
