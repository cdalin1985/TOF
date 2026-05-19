-- Recovered from Supabase migration history (version 20260322190050).
-- Source: supabase_migrations.schema_migrations
-- Name: fix_push_subscriptions_schema


-- Drop the old table and recreate to match CC's code which expects a single subscription JSON column
DROP TABLE IF EXISTS push_subscriptions;

CREATE TABLE push_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  subscription JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(player_id)
);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own subscriptions" ON push_subscriptions
  FOR ALL USING (
    player_id IN (SELECT id FROM players WHERE profile_id = auth.uid())
  );
