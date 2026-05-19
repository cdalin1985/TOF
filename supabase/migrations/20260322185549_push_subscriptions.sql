-- Recovered from Supabase migration history (version 20260322185549).
-- Source: supabase_migrations.schema_migrations
-- Name: push_subscriptions


CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  keys_p256dh TEXT NOT NULL,
  keys_auth TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(player_id, endpoint)
);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own subscriptions" ON push_subscriptions
  FOR ALL USING (
    player_id IN (SELECT id FROM players WHERE profile_id = auth.uid())
  );

ALTER PUBLICATION supabase_realtime ADD TABLE push_subscriptions;
