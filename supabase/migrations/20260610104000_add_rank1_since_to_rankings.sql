-- Restore ranking metadata required by cascade_ranking_after_win and rank-1 compliance.

alter table public.rankings
  add column if not exists rank1_since timestamptz;

update public.rankings
set rank1_since = coalesce(rank1_since, updated_at, now())
where position = 1;
