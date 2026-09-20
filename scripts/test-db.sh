#!/usr/bin/env bash
# Applies the Supabase shim, all migrations and the SQL security tests to a throw-away
# PostgreSQL database. Requires `psql` and a role that can CREATE DATABASE and CREATE ROLE
# (roles anon / authenticated / service_role are created if missing).
#
# Connection is taken from the standard libpq variables (PGHOST, PGPORT, PGUSER, PGPASSWORD).
# Example with Docker:
#   docker run -d --name gdg-pg -e POSTGRES_PASSWORD=postgres -p 54329:5432 postgres:16
#   PGHOST=localhost PGPORT=54329 PGUSER=postgres PGPASSWORD=postgres npm run test:db
set -euo pipefail
cd "$(dirname "$0")/.."

DB="${TEST_DB_NAME:-gdg_directory_test}"

if ! command -v psql >/dev/null 2>&1; then
  echo "psql not found. Install the PostgreSQL client or run supabase/tests/security.sql in the Supabase SQL editor." >&2
  exit 2
fi

cleanup() { psql -q -d postgres -c "drop database if exists ${DB}" >/dev/null 2>&1 || true; }
trap cleanup EXIT

psql -v ON_ERROR_STOP=1 -q -d postgres -c "drop database if exists ${DB}" -c "create database ${DB}"

run_file() { psql -v ON_ERROR_STOP=1 -q -d "${DB}" -f "$1"; }

echo "==> Applying test shim"
run_file supabase/tests/local/00_supabase_shim.sql

for f in supabase/migrations/*.sql; do
  echo "==> Applying ${f}"
  run_file "${f}"
done

echo "==> Running security tests"
psql -v ON_ERROR_STOP=1 -q -d "${DB}" -f supabase/tests/security.sql 2>&1 \
  | sed -E 's/^psql:[^ ]+ (NOTICE|ERROR):  ?/\1 /' \
  | sed -E 's/^NOTICE //'
