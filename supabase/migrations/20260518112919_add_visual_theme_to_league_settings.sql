-- Recovered from Supabase migration history (version 20260518112919).
-- Source: supabase_migrations.schema_migrations
-- Name: add_visual_theme_to_league_settings

begin;

alter table public.league_settings
  add column if not exists theme_name text;

update public.league_settings
set theme_name = coalesce(theme_name, 'classic');

alter table public.league_settings
  alter column theme_name set default 'classic';

alter table public.league_settings
  alter column theme_name set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'league_settings_theme_name_check'
  ) then
    alter table public.league_settings
      add constraint league_settings_theme_name_check
      check (theme_name in ('classic', 'neon-billiards', 'emerald-forest'));
  end if;
end $$;

commit;
