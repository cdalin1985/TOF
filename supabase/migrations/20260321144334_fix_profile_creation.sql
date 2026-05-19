-- Recovered from Supabase migration history (version 20260321144334).
-- Source: supabase_migrations.schema_migrations
-- Name: fix_profile_creation


-- Drop the restrictive insert policy
DROP POLICY IF EXISTS "Auto-create profile on signup" ON profiles;

-- Add a policy that allows the trigger function to insert profiles
CREATE POLICY "Service role can insert profiles" ON profiles 
  FOR INSERT 
  WITH CHECK (true);

-- Also recreate the trigger function to be more robust
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, role)
  VALUES (
    NEW.id, 
    NEW.email,
    CASE 
      WHEN NEW.email = 'chase.dalin@gmail.com' THEN 'super_admin'
      ELSE 'player'
    END
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Make sure the trigger is properly attached
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
