-- Reporting views for external admin dashboards such as UI Bakery.
-- These views flatten the live TOF tables into read-friendly shapes without
-- changing any app data or challenge/ranking behavior.

CREATE OR REPLACE VIEW public.admin_dashboard_leaderboard AS
SELECT
  r.position,
  p.id AS player_id,
  p.full_name,
  p.is_active,
  (p.profile_id IS NOT NULL) AS is_claimed,
  prm.fargo_rating,
  prm.fargo_robustness,
  COALESCE(pss.matches_played, 0) AS matches_played,
  COALESCE(pss.wins, 0) AS wins,
  COALESCE(pss.losses, 0) AS losses,
  COALESCE(pss.points, 0) AS points,
  COALESCE(pss.current_streak, 0) AS current_streak,
  COALESCE(pss.best_streak, 0) AS best_streak,
  r.previous_position,
  r.updated_at AS ranking_updated_at,
  p.updated_at AS player_updated_at
FROM public.rankings r
JOIN public.players p ON p.id = r.player_id
LEFT JOIN public.player_reference_metrics prm ON prm.player_id = p.id
LEFT JOIN public.player_season_stats pss ON pss.player_id = p.id;

CREATE OR REPLACE VIEW public.admin_dashboard_challenges AS
SELECT
  c.id AS challenge_id,
  c.status,
  c.discipline,
  c.race_length,
  c.venue,
  c.scheduled_at,
  c.expires_at,
  challenger.id AS challenger_id,
  challenger.full_name AS challenger_name,
  challenger_rank.position AS challenger_rank,
  challenged.id AS challenged_id,
  challenged.full_name AS challenged_name,
  challenged_rank.position AS challenged_rank,
  c.created_at,
  c.updated_at
FROM public.challenges c
JOIN public.players challenger ON challenger.id = c.challenger_id
JOIN public.players challenged ON challenged.id = c.challenged_id
LEFT JOIN public.rankings challenger_rank ON challenger_rank.player_id = challenger.id
LEFT JOIN public.rankings challenged_rank ON challenged_rank.player_id = challenged.id;

CREATE OR REPLACE VIEW public.admin_dashboard_matches AS
SELECT
  m.id AS match_id,
  m.challenge_id,
  m.status,
  m.discipline,
  m.race_length,
  m.venue,
  m.scheduled_at,
  m.started_at,
  m.completed_at,
  p1.id AS player1_id,
  p1.full_name AS player1_name,
  p2.id AS player2_id,
  p2.full_name AS player2_name,
  m.player1_score,
  m.player2_score,
  winner.full_name AS winner_name,
  loser.full_name AS loser_name,
  m.created_at,
  m.updated_at
FROM public.matches m
JOIN public.players p1 ON p1.id = m.player1_id
JOIN public.players p2 ON p2.id = m.player2_id
LEFT JOIN public.players winner ON winner.id = m.winner_id
LEFT JOIN public.players loser ON loser.id = m.loser_id;

CREATE OR REPLACE VIEW public.admin_dashboard_league_overview AS
SELECT
  (SELECT COUNT(*) FROM public.players WHERE is_active = true) AS active_player_count,
  (SELECT COUNT(*) FROM public.players WHERE profile_id IS NOT NULL) AS claimed_player_count,
  (SELECT COUNT(*) FROM public.challenges WHERE status IN ('pending', 'accepted', 'scheduled', 'in_progress', 'submitted', 'disputed')) AS open_challenge_count,
  (SELECT COUNT(*) FROM public.matches WHERE status IN ('scheduled', 'in_progress', 'submitted', 'disputed')) AS open_match_count,
  (SELECT COUNT(*) FROM public.matches WHERE status IN ('confirmed', 'resolved')) AS completed_match_count,
  (SELECT balance_cents FROM public.treasury_summary) AS treasury_balance_cents,
  (SELECT last_entry_at FROM public.treasury_summary) AS treasury_last_entry_at,
  ls.venues,
  ls.disciplines,
  ls.min_race,
  ls.max_race,
  ls.challenge_range,
  ls.first_challenge_range,
  ls.cooldown_hours,
  ls.challenge_expiry_days,
  ls.theme_name,
  ls.updated_at AS settings_updated_at
FROM public.league_settings ls
LIMIT 1;

GRANT SELECT ON public.admin_dashboard_leaderboard TO authenticated, service_role;
GRANT SELECT ON public.admin_dashboard_challenges TO authenticated, service_role;
GRANT SELECT ON public.admin_dashboard_matches TO authenticated, service_role;
GRANT SELECT ON public.admin_dashboard_league_overview TO authenticated, service_role;
