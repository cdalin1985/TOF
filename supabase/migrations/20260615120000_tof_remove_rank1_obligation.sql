-- Top of the Falls: remove the inherited "Rank #1 obligation" rule.
--
-- The TOC 1 baseline forced the #1 player to play two top-5 opponents within
-- 30 days of reaching #1 or be auto-demoted to #10. The Top of the Falls
-- ruleset has NO such rule, so we neutralize the enforcement here.
--
-- We keep the function signatures in place (other code/grants may reference
-- them) but turn them into safe no-ops, and clear any rank1 clock so no
-- player is mid-window. This is idempotent and reversible.

-- 1. Make the auto-enforcer a no-op.
CREATE OR REPLACE FUNCTION public.check_and_enforce_rank1_obligation()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN jsonb_build_object(
    'action', 'disabled',
    'reason', 'Top of the Falls has no Rank #1 obligation rule.',
    'at', NOW()
  );
END;
$$;

COMMENT ON FUNCTION public.check_and_enforce_rank1_obligation() IS
  'Disabled for Top of the Falls — the TOF ruleset has no Rank #1 obligation. No-op.';

-- 2. Make the penalty a no-op so it can never demote the #1 player.
--    Keeps the existing integer return type to stay signature-compatible.
CREATE OR REPLACE FUNCTION public.apply_rank1_penalty(p_player_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Intentionally does nothing. Top of the Falls has no Rank #1 obligation.
  RETURN 0;
END;
$$;

COMMENT ON FUNCTION public.apply_rank1_penalty(uuid) IS
  'Disabled for Top of the Falls — no Rank #1 obligation. No-op, returns 0.';

-- 3. Clear any in-progress rank-1 clock so no UI or job treats a player as
--    being "on the clock".
UPDATE public.rankings SET rank1_since = NULL WHERE rank1_since IS NOT NULL;

-- 4. Audit trail.
INSERT INTO public.audit_events (action, target_type, detail)
VALUES (
  'tof_rank1_obligation_removed',
  'league_settings',
  jsonb_build_object(
    'league', 'Top of the Falls',
    'note', 'Rank #1 obligation enforcement disabled to match the TOF ruleset.'
  )
);
