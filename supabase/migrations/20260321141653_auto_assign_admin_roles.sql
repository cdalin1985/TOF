-- Recovered from Supabase migration history (version 20260321141653).
-- Source: supabase_migrations.schema_migrations
-- Name: auto_assign_admin_roles


-- After a profile is created, check if the email matches an admin and set their role
CREATE OR REPLACE FUNCTION assign_admin_on_signup()
RETURNS TRIGGER AS $$
BEGIN
  -- Chase Dalin = super_admin
  IF NEW.email = 'chase.dalin@gmail.com' THEN
    NEW.role := 'super_admin';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_profile_created_assign_admin ON profiles;
CREATE TRIGGER on_profile_created_assign_admin
  BEFORE INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION assign_admin_on_signup();
