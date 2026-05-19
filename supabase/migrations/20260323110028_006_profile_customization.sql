-- Recovered from Supabase migration history (version 20260323110028).
-- Source: supabase_migrations.schema_migrations
-- Name: 006_profile_customization

ALTER TABLE players ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE players ADD COLUMN IF NOT EXISTS preferred_discipline TEXT
  CHECK (preferred_discipline IN ('8 Ball', '9 Ball', '10 Ball'));

CREATE POLICY "Players can update own player record"
  ON players FOR UPDATE
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());
