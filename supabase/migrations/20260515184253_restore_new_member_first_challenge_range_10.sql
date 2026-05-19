-- Recovered from Supabase migration history (version 20260515184253).
-- Source: supabase_migrations.schema_migrations
-- Name: restore_new_member_first_challenge_range_10

update public.league_settings
set
  min_race = 6,
  challenge_range = 5,
  cooldown_hours = 24,
  first_challenge_range = 10,
  updated_at = now();

insert into public.audit_events (action, target_type, detail)
values (
  'canon_settings_realigned',
  'league_settings',
  jsonb_build_object(
    'min_race', 6,
    'challenge_range', 5,
    'cooldown_hours', 24,
    'first_challenge_range', 10,
    'note', 'Restored new league member first-challenge range to 10. Non-top-10 regular players challenge up 5. Top-10 players challenge up/down 5. Rank #1 may challenge anyone.'
  )
);
