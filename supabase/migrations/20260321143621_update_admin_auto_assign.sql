-- Recovered from Supabase migration history (version 20260321143621).
-- Source: supabase_migrations.schema_migrations
-- Name: update_admin_auto_assign


CREATE OR REPLACE FUNCTION assign_admin_on_signup()
RETURNS TRIGGER AS $$
BEGIN
  -- Chase Dalin = super_admin
  IF NEW.email = 'chase.dalin@gmail.com' THEN
    NEW.role := 'super_admin';
  -- Dave Alderman = admin
  ELSIF NEW.email = 'aldermancompanies@gmail.com' THEN
    NEW.role := 'admin';
  -- Thomas Kingston = admin
  ELSIF NEW.email = 'No1patsfan1981@yahoo.com' THEN
    NEW.role := 'admin';
  -- Eric Croft = admin
  ELSIF NEW.email = 'ecroft@bresnan.net' THEN
    NEW.role := 'admin';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
