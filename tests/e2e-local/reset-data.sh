#!/bin/sh
set -e
psql -v ON_ERROR_STOP=1 -q -d gdg_e2e -c "truncate public.volunteers, public.teams, public.admin_users, auth.users, storage.objects cascade"
psql -v ON_ERROR_STOP=1 -q -d gdg_e2e -f tests/e2e-local/fixtures.sql
echo "data reset: $(psql -At -d gdg_e2e -c 'select count(*) from volunteers') volunteers"
