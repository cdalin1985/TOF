-- Align live challenge venue constraint with Top of the Falls league_settings.
-- The UI/backend read venues from league_settings, but this recovered TOC constraint
-- still allowed only the original TOC venues and blocked challenge acceptance.

alter table public.challenges
  drop constraint if exists challenges_venue_check;

alter table public.challenges
  add constraint challenges_venue_check
  check (
    venue is null
    or venue = any (array[
      'Silver Spur'::text,
      'Lido'::text,
      'Black Eagle Country Club'::text
    ])
  );
