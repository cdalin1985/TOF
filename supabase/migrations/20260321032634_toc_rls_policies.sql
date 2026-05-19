-- Recovered from Supabase migration history (version 20260321032634).
-- Source: supabase_migrations.schema_migrations
-- Name: toc_rls_policies


ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view profiles" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Auto-create profile on signup" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

ALTER TABLE players ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view players" ON players FOR SELECT USING (true);
CREATE POLICY "Admins can manage players" ON players FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
);

ALTER TABLE rankings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view rankings" ON rankings FOR SELECT USING (true);

ALTER TABLE player_reference_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view metrics" ON player_reference_metrics FOR SELECT USING (true);

ALTER TABLE challenges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view challenges" ON challenges FOR SELECT USING (true);

ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view matches" ON matches FOR SELECT USING (true);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own notifications" ON notifications FOR SELECT USING (
  player_id IN (SELECT id FROM players WHERE profile_id = auth.uid())
);
CREATE POLICY "Users can mark own notifications read" ON notifications FOR UPDATE USING (
  player_id IN (SELECT id FROM players WHERE profile_id = auth.uid())
) WITH CHECK (
  player_id IN (SELECT id FROM players WHERE profile_id = auth.uid())
);

ALTER TABLE activity_feed ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view activity feed" ON activity_feed FOR SELECT USING (true);

ALTER TABLE cooldowns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view cooldowns" ON cooldowns FOR SELECT USING (true);

ALTER TABLE player_season_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view stats" ON player_season_stats FOR SELECT USING (true);

ALTER TABLE treasury_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view treasury" ON treasury_ledger FOR SELECT USING (true);
CREATE POLICY "Super admins can insert treasury entries" ON treasury_ledger FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
);

ALTER TABLE league_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view settings" ON league_settings FOR SELECT USING (true);
CREATE POLICY "Super admins can update settings" ON league_settings FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
);

ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view audit events" ON audit_events FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
);
