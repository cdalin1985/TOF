-- TOF challenge-rule enforcement support.
-- Allows the TOF-specific Saratoga discipline in persisted challenges and keeps
-- database constraints aligned with backend/UI league settings.

alter table public.challenges
  drop constraint if exists challenges_discipline_check;

alter table public.challenges
  add constraint challenges_discipline_check
  check (discipline in ('8 Ball', '9 Ball', '10 Ball', 'Saratoga'));

alter table public.players
  drop constraint if exists players_preferred_discipline_check;

alter table public.players
  add constraint players_preferred_discipline_check
  check (preferred_discipline is null or preferred_discipline in ('8 Ball', '9 Ball', '10 Ball', 'Saratoga'));

alter table public.player_discipline_stats
  add column if not exists challenges_issued integer not null default 0;

alter table public.player_discipline_stats
  add column if not exists challenges_received integer not null default 0;

insert into public.audit_events (action, target_type, detail)
values (
  'tof_challenge_rules_applied',
  'league_settings',
  jsonb_build_object(
    'league', 'Top of the Falls',
    'saratoga', 'Only allowed when both players are ranked in the Top 20.',
    'ranking_rules', array[
      '#1 may challenge ranks #2-#5 to satisfy obligation',
      'Ranks #2-#11 may challenge one spot up',
      'Ranks #12+ may challenge up to challenge_range spots above them'
    ]
  )
);
