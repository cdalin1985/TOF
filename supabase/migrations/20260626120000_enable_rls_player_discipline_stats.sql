-- Bring player_discipline_stats in line with its sibling stats tables
-- (player_season_stats, player_reference_metrics, rankings): RLS on, with a
-- single public read policy. Writes are intentionally left with no policy so
-- only the service-role edge functions (which bypass RLS) can mutate them.
--
-- Fixes Supabase advisor: rls_disabled_in_public on public.player_discipline_stats.
alter table public.player_discipline_stats enable row level security;

drop policy if exists "Anyone can view discipline stats" on public.player_discipline_stats;
create policy "Anyone can view discipline stats"
  on public.player_discipline_stats
  for select
  to public
  using (true);
