-- TOF / Top of the Falls league settings.
-- Keeps TOF separate from TOC 1 while preserving the shared app schema.

alter table public.league_settings drop constraint if exists league_settings_theme_name_check;
alter table public.league_settings
  add constraint league_settings_theme_name_check
  check (theme_name in ('classic', 'neon-billiards', 'emerald-forest'));

update public.league_settings
set
  venues = array['Silver Spur', 'Lido', 'Black Eagle Country Club'],
  disciplines = array['8 Ball', '9 Ball', '10 Ball', 'Saratoga'],
  min_race = 6,
  max_race = null,
  challenge_range = 2,
  first_challenge_range = 2,
  cooldown_hours = 24,
  challenge_expiry_days = 2,
  theme_name = 'emerald-forest',
  updated_at = now();

insert into public.audit_events (action, target_type, detail)
values (
  'tof_settings_applied',
  'league_settings',
  jsonb_build_object(
    'league', 'Top of the Falls',
    'venues', array['Silver Spur', 'Lido', 'Black Eagle Country Club'],
    'disciplines', array['8 Ball', '9 Ball', '10 Ball', 'Saratoga'],
    'theme_name', 'emerald-forest',
    'note', 'TOF settings applied after clean white-label schema bootstrap.'
  )
);
