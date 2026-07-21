-- Enable Row Level Security (RLS) on all existing public tables, and
-- auto-enable RLS for every future CREATE TABLE in this database.
--
-- No policies are created: non-owner / non-superuser roles see no rows;
-- table owners still bypass RLS (Postgres default).
--
-- Safe to re-run (idempotent).
--
-- Apply via Django (preferred for app DBs):
--   python manage.py migrate
--
-- Or manually against Docker Postgres:
--   docker exec -i finance-dashboard-db psql -U finance -d finance < scripts/enable_rls.sql
--
-- Or with local psql:
--   psql -h 127.0.0.1 -U finance -d finance -f scripts/enable_rls.sql

BEGIN;

-- Existing base tables in public
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT n.nspname AS schemaname, c.relname AS tablename
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'r'
      AND n.nspname = 'public'
  LOOP
    EXECUTE format(
      'ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY',
      r.schemaname,
      r.tablename
    );
  END LOOP;
END;
$$;

-- Auto-enable RLS whenever a new table is created
CREATE OR REPLACE FUNCTION public.enable_rls_on_create_table()
RETURNS event_trigger
LANGUAGE plpgsql
AS $$
DECLARE
  obj record;
BEGIN
  FOR obj IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag = 'CREATE TABLE'
      AND object_type = 'table'
      AND schema_name = 'public'
  LOOP
    EXECUTE format(
      'ALTER TABLE IF EXISTS %s ENABLE ROW LEVEL SECURITY',
      obj.object_identity
    );
  END LOOP;
END;
$$;

DROP EVENT TRIGGER IF EXISTS enable_rls_on_create_table;

CREATE EVENT TRIGGER enable_rls_on_create_table
ON ddl_command_end
WHEN TAG IN ('CREATE TABLE')
EXECUTE FUNCTION public.enable_rls_on_create_table();

COMMIT;
