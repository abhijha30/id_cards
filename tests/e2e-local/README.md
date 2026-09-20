# Local end-to-end harness (reference, not part of `npm test`)

These scripts were used to test the running app in a browser without a real Supabase project. They are provided so the results in `docs/TESTING.md` can be repeated, and they are **not** a supported test suite: paths and users are examples you will need to adjust.

## What it stands up

| Piece | What it is |
| --- | --- |
| Postgres | A local database with `supabase/tests/local/00_supabase_shim.sql`, all migrations, and generated fixtures. |
| PostgREST | The real PostgREST server (github.com/PostgREST/postgrest), so queries and RLS behave like Supabase's data API. |
| `gateway.mjs` | A small Node server on port 54321 that forwards `/rest/v1` to PostgREST and **mocks** `/auth/v1` (password login) and `/storage/v1` (upload, download, sign, delete). Storage calls are authorised by running the real `storage.objects` RLS policies in Postgres. |
| `e2e-public.mjs`, `e2e-admin.mjs` | Playwright scripts driving Chromium against the app (`next build && next start`). |

Because auth and storage are mocks, this checks the app and the database rules, **not** Supabase's own Auth and Storage services.

## Rough steps

1. Create a database and load the shim, migrations and fixtures (`python3 setup-db.py` writes `fixtures.sql`; then `psql -f` each file, as in `scripts/test-db.sh`). Use a database name of `gdg_e2e` or set `E2E_DB`.
2. Start PostgREST with `pgrst.conf` (edit the DB user and the `jwt-secret`).
3. `JWT_SECRET=<same secret> node gateway.mjs`. It prints an `ANON_KEY=` line.
4. Build and start the app with `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321`, `NEXT_PUBLIC_SUPABASE_ANON_KEY=<that key>`, `NEXT_PUBLIC_SITE_URL=https://directory.example.org`, `NEXT_PUBLIC_CONTACT_EMAIL=volunteers@example.org`.
5. `npm i --no-save pg playwright` then `node e2e-public.mjs` and `node e2e-admin.mjs`. Run `sh reset-data.sh` between admin runs (it truncates and reloads the fixtures).

The admin script also needs `psql` on the PATH, and the login fixtures are `admin@example.test` / `plain@example.test`.
