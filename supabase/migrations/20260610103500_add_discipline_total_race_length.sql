-- Restore discipline-stat aggregate required by submit-result.
-- Tracks total race length played per discipline for future averages/reporting.

alter table public.player_discipline_stats
  add column if not exists total_race_length integer not null default 0;

update public.player_discipline_stats
set total_race_length = 0
where total_race_length is null;
