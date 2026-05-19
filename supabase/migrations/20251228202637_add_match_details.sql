-- Recovered from Supabase migration history (version 20251228202637).
-- Source: supabase_migrations.schema_migrations
-- Name: add_match_details

ALTER TABLE matches 
ADD COLUMN IF NOT EXISTS venue text,
ADD COLUMN IF NOT EXISTS match_date timestamp with time zone;
