-- Recovered from Supabase migration history (version 20260507040125).
-- Source: supabase_migrations.schema_migrations
-- Name: 008_expire_stale_challenges

-- Auto-expire challenges past their 7-day response window.
--
-- The challenges table has expires_at NOT NULL set 7 days into the future
-- on insert (in the create-challenge edge function). Without something
-- flipping the status, those rows sit at status='pending' indefinitely
-- and block new challenges (because create-challenge checks for existing
-- pending rows with no regard for expires_at).
--
-- This function is idempotent: it only updates rows where status='pending'
-- AND expires_at has already passed; a row updated to 'expired' won't
-- match the WHERE clause on a subsequent call.

CREATE OR REPLACE FUNCTION public.expire_stale_challenges()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected_count INTEGER;
BEGIN
  UPDATE challenges
  SET status     = 'expired',
      updated_at = NOW()
  WHERE status     = 'pending'
    AND expires_at <= NOW();

  GET DIAGNOSTICS affected_count = ROW_COUNT;
  RETURN affected_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.expire_stale_challenges() TO authenticated, service_role;

COMMENT ON FUNCTION public.expire_stale_challenges() IS
  'Marks any challenges with status=pending and expires_at in the past as status=expired. Returns the number of rows updated. Called by create-challenge edge function before checking for existing pending challenges. Safe to call repeatedly.';
