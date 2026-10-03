-- Defense in depth for Supabase: RLS is already enabled with no policies on these tables
-- (20260930111956_profile_settings_feedback). Also revoke the public-API roles' grants so the
-- tables are not exposed through PostgREST even if a permissive policy is added by mistake.
-- Guarded: on plain Postgres (local Docker / CI) the roles do not exist and this is a no-op.
DO $$
DECLARE
  r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON TABLE "PasswordChangeCode", "Feedback" FROM %I', r);
    END IF;
  END LOOP;
END
$$;
