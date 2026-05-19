-- Recovered from Supabase migration history (version 20260515183344).
-- Source: supabase_migrations.schema_migrations
-- Name: align_toc_canon_settings_min_race_6

update public.league_settings
set
  min_race = 6,
  challenge_range = 5,
  cooldown_hours = 24,
  first_challenge_range = 5,
  updated_at = now();

insert into public.audit_events (action, target_type, detail)
values (
  'canon_settings_aligned',
  'league_settings',
  jsonb_build_object(
    'min_race', 6,
    'challenge_range', 5,
    'cooldown_hours', 24,
    'first_challenge_range', 5,
    'note', 'Aligned live TOC settings: minimum race remains 6; standard challenge range is 5; post-loss cooldown is 24 hours; removed first-challenge 10-rank exception by setting it to 5.'
  )
);
