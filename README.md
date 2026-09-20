# GDG Noida Volunteer Directory

A public directory of GDG Noida volunteers. **Every volunteer ID card carries the same QR code.** It opens this site, and the person scanning searches for the name on the card to confirm who they are talking to. There are no per-volunteer QR codes.

- Public visitors can search and view **published, consented** profiles only. No login, no cookies, no analytics.
- Administrators sign in with email and password to add and edit volunteers, upload real photos, manage teams, record consent, publish or unpublish profiles, and download the master QR code.
- Data lives in Supabase (Postgres, Auth, Storage). Row Level Security enforces the rules in the database, not just in the UI.

Stack: Next.js 16 (App Router), React 19, TypeScript (strict), Tailwind CSS 4, Supabase, Zod, deployed on Vercel.

## Quick start

Requirements: Node.js 22.12 or newer, a Supabase project, and (optionally) `psql` for the database tests.

```bash
npm install
cp .env.example .env.local      # then fill in the values
npm run dev                     # http://localhost:3000
```

Before the app can show anything you must set up Supabase (migrations, an admin user): see **[docs/SUPABASE-SETUP.md](docs/SUPABASE-SETUP.md)**.

### Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | yes | Public address of the directory. The master QR code encodes this exact value. Use the final production domain before printing ID cards. |
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Supabase project URL. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | Supabase anon (publishable) key. Safe in the browser because RLS protects the data. |
| `NEXT_PUBLIC_CONTACT_EMAIL` | no | Address shown on the privacy page for correction and removal requests. |

`NEXT_PUBLIC_*` values are compiled into the build, so **redeploy after changing any of them**. The app never uses the Supabase service-role key; do not add it.

### Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` / `build` / `start` | Development server, production build, production server. |
| `npm run typecheck` | TypeScript in strict mode. |
| `npm run lint` | ESLint (flat config, Next.js rules). |
| `npm test` | Unit tests (Vitest): validation, URL safety, photo checks, QR contents. |
| `npm run test:db` | Applies the migrations to a throw-away Postgres and runs the SQL security tests. Needs `psql`; see the header of `scripts/test-db.sh`. |
| `npm run check` | Typecheck, lint and unit tests together. |

## How it fits together

```
app/                     Routes: public directory, profiles, photos, privacy, admin, API
  admin/(protected)/     Signed-in admin pages and server actions
components/              UI (directory, volunteer, admin, uploader, qr, ui)
lib/                     Config, validation (Zod), data access, Supabase clients, QR, utilities
proxy.ts                 Refreshes the admin session cookie and redirects signed-out /admin visits
supabase/migrations/     Schema, RLS + grants + public view, private storage bucket
supabase/tests/          SQL security tests (run in the SQL editor, or with npm run test:db)
supabase/seed.sql        Optional example teams
docs/                    Setup, deployment, security, privacy checklist, testing notes
```

Things worth knowing before you change code:

- **Public pages never use a user session.** They query with the anon key and no cookies, so even an administrator browsing the public site sees exactly what a visitor sees.
- **Admin authorisation is server-side.** `requireAdmin()` runs in every admin page, route and server action, and checks the `admin_users` table (never user-editable metadata). RLS repeats the check in the database.
- **Photos are private.** They sit in a private Storage bucket and are served through `/photos/[slug]` only while the volunteer is published with consent granted.
- **Photos upload directly from the browser to Storage** (Vercel functions cap request bodies at about 4.5 MB, below the 5 MB limit). A server action then verifies the stored file before attaching it.

## Customising

All the switches organisers may want are in `lib/config.ts`: the logo (`BRAND_LOGO_SRC`), page sizes, search-engine indexing (off by default), and the consent notice version. The team names in `supabase/seed.sql` are examples; manage real teams from **/admin/teams**.

**Logo:** the header shows a neutral placeholder mark, not the GDG logo. Put the approved asset in `public/brand/` and set `BRAND_LOGO_SRC`.

## Documentation

- [docs/SUPABASE-SETUP.md](docs/SUPABASE-SETUP.md): create the project, run migrations, create the first admin.
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md): GitHub and Vercel steps, production checklist, printing the QR code.
- [docs/SECURITY.md](docs/SECURITY.md): every access rule and why.
- [docs/PRIVACY-CHECKLIST.md](docs/PRIVACY-CHECKLIST.md): decisions the organisers must make before launch.
- [docs/TESTING.md](docs/TESTING.md): what was tested, how to repeat it, and what was not tested.

## Licence

No licence has been chosen for this project. Add one before publishing the repository publicly.
