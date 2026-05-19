-- Recovered from Supabase migration history (version 20251228203910).
-- Source: supabase_migrations.schema_migrations
-- Name: add_robustness_column

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS robustness integer DEFAULT 0;
