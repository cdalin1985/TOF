-- ============================================================
-- TOC App - Migration 011: Lock Down Security Definer RPC
-- ============================================================
-- Supabase grants EXECUTE broadly by default. Revoke explicit anon and
-- authenticated grants from SECURITY DEFINER helpers that should only run
-- through Edge Functions, triggers, or cron.

REVOKE ALL ON FUNCTION public.cascade_ranking_after_win(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cascade_ranking_after_win(uuid, uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cascade_ranking_after_win(uuid, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.apply_rank1_penalty(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.apply_rank1_penalty(uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_rank1_penalty(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.enforce_rank1_obligations() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enforce_rank1_obligations() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_rank1_obligations() TO service_role;

REVOKE ALL ON FUNCTION public.check_and_enforce_rank1_obligation() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.check_and_enforce_rank1_obligation() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_and_enforce_rank1_obligation() TO service_role;

REVOKE ALL ON FUNCTION public.expire_stale_challenges() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.expire_stale_challenges() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_stale_challenges() TO service_role;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM anon, authenticated;
ALTER FUNCTION public.handle_new_user() SET search_path = public;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'assign_admin_on_signup'
  ) THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.assign_admin_on_signup() FROM PUBLIC';
    EXECUTE 'REVOKE ALL ON FUNCTION public.assign_admin_on_signup() FROM anon, authenticated';
    EXECUTE 'ALTER FUNCTION public.assign_admin_on_signup() SET search_path = public';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'get_ranked_players'
  ) THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.get_ranked_players() FROM PUBLIC';
    EXECUTE 'REVOKE ALL ON FUNCTION public.get_ranked_players() FROM anon, authenticated';
    EXECUTE 'ALTER FUNCTION public.get_ranked_players() SET search_path = public';
  END IF;
END;
$$;
