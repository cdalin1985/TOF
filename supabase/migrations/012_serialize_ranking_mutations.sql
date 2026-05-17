-- ============================================================
-- TOC App - Migration 012: Serialize Ranking Mutations
-- ============================================================
-- ROW EXCLUSIVE locks do not conflict with each other. These rank mutators
-- need a self-conflicting lock so simultaneous match confirmations or rank
-- penalties cannot interleave after reading stale positions.

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
  LOCK TABLE public.rankings IN SHARE ROW EXCLUSIVE MODE;

  SELECT position INTO v_winner_pos
  FROM public.rankings
  WHERE player_id = p_winner_id;

  SELECT position INTO v_loser_pos
  FROM public.rankings
  WHERE player_id = p_loser_id;

  IF v_winner_pos IS NULL OR v_loser_pos IS NULL OR v_winner_pos <= v_loser_pos THEN
    RETURN;
  END IF;

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
  LOCK TABLE public.rankings IN SHARE ROW EXCLUSIVE MODE;

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

REVOKE ALL ON FUNCTION public.cascade_ranking_after_win(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cascade_ranking_after_win(uuid, uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cascade_ranking_after_win(uuid, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.apply_rank1_penalty(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.apply_rank1_penalty(uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_rank1_penalty(uuid) TO service_role;
