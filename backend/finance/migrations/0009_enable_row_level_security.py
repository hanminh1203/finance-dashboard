"""Enable RLS on all public tables; auto-enable for future CREATE TABLE.

Mirrors scripts/enable_rls.sql. Keep the two in sync when changing RLS setup.
"""

from django.db import migrations

FORWARD_SQL = """
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
"""

REVERSE_SQL = """
DROP EVENT TRIGGER IF EXISTS enable_rls_on_create_table;
DROP FUNCTION IF EXISTS public.enable_rls_on_create_table();

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
      AND c.relrowsecurity
  LOOP
    EXECUTE format(
      'ALTER TABLE %I.%I DISABLE ROW LEVEL SECURITY',
      r.schemaname,
      r.tablename
    );
  END LOOP;
END;
$$;
"""


class Migration(migrations.Migration):

    dependencies = [
        ('finance', '0008_giftcard_row_number'),
    ]

    operations = [
        migrations.RunSQL(sql=FORWARD_SQL, reverse_sql=REVERSE_SQL),
    ]
