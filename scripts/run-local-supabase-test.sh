#!/usr/bin/env bash
# Local Postgres proof for Supabase GRANT + RLS (no live Supabase project required).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DB_NAME="creatorexec_supabase_test"
DB_USER="creatorexec_test"

export PGHOST="${PGHOST:-127.0.0.1}"
export PGPORT="${PGPORT:-5432}"
ADMIN_PGHOST="/var/run/postgresql"

if ! command -v psql >/dev/null 2>&1; then
  echo "PostgreSQL client not found. Install postgresql and re-run."
  exit 1
fi

if ! sudo -n service postgresql status >/dev/null 2>&1; then
  sudo service postgresql start
fi

sudo -u postgres env PGHOST="$ADMIN_PGHOST" psql -v ON_ERROR_STOP=1 <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '$DB_USER') THEN
    CREATE ROLE $DB_USER LOGIN PASSWORD 'creatorexec_test';
  ELSE
    ALTER ROLE $DB_USER WITH LOGIN PASSWORD 'creatorexec_test';
  END IF;
END
\$\$;

SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = '$DB_NAME' AND pid <> pg_backend_pid();

DROP DATABASE IF EXISTS $DB_NAME;
CREATE DATABASE $DB_NAME OWNER $DB_USER;
SQL

sudo -u postgres env PGHOST="$ADMIN_PGHOST" psql -v ON_ERROR_STOP=1 -d "$DB_NAME" <<'SQL'
-- Minimal Supabase-compatible bootstrap (roles + auth.users FK target)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN BYPASSRLS;
  END IF;
END
$$;

CREATE SCHEMA IF NOT EXISTS auth;

CREATE TABLE IF NOT EXISTS auth.users (
  id uuid PRIMARY KEY
);

CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
SQL

for migration in "$ROOT"/supabase/migrations/*.sql; do
  echo "Applying $(basename "$migration")"
  sudo -u postgres env PGHOST="$ADMIN_PGHOST" psql -v ON_ERROR_STOP=1 -d "$DB_NAME" -f "$migration"
done

sudo -u postgres env PGHOST="$ADMIN_PGHOST" psql -v ON_ERROR_STOP=1 -d "$DB_NAME" <<'SQL'
GRANT anon, authenticated TO creatorexec_test;
GRANT USAGE ON SCHEMA auth TO creatorexec_test;
GRANT INSERT ON TABLE auth.users TO creatorexec_test;
SQL

echo "Local database ready: $DB_NAME"
node "$ROOT/scripts/test-supabase-local.mjs"
