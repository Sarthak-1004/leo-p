-- Restricted runtime role for the portal API (run once as the schema owner).
-- Afterwards: MIGRATION_DATABASE_URL = owner connection, DATABASE_URL = portal_runtime connection.
-- The runtime role cannot alter or drop tables or triggers, and can only read and append history.
-- Replace the password before running; never commit the real value.
CREATE ROLE portal_runtime LOGIN PASSWORD 'replace-with-a-long-random-password';
GRANT USAGE ON SCHEMA public TO portal_runtime;
REVOKE CREATE ON SCHEMA public FROM portal_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO portal_runtime;
REVOKE UPDATE, DELETE, TRUNCATE ON "AuditLog", "ScoreRevision" FROM portal_runtime;
DO $$ BEGIN IF to_regclass('"_prisma_migrations"') IS NOT NULL THEN EXECUTE 'REVOKE ALL ON "_prisma_migrations" FROM portal_runtime'; END IF; END $$;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO portal_runtime;
-- Tables created by later migrations get the same table grants; re-run the two REVOKE lines
-- above if a migration recreates the history tables.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO portal_runtime;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO portal_runtime;
