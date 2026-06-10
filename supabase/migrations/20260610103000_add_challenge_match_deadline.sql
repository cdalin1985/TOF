-- Restore challenge match deadline column required by respond-to-challenge.
-- The Edge Function writes this when a challenge is accepted so the match has a 10-day play window.

alter table public.challenges
  add column if not exists match_deadline timestamptz;
