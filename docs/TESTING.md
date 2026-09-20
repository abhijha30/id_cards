# Testing notes

An honest account of what was checked, how to repeat it, and what has **not** been checked.

## Repeatable checks (in the repository)

| Command | Result when this was written |
| --- | --- |
| `npm run typecheck` | Clean (TypeScript strict). |
| `npm run lint` | Clean (ESLint 9, Next.js rules). |
| `npm test` | 50 unit tests pass: form validation, social-URL safety, slugs, search escaping, photo signatures and paths, redirect safety, site-URL checks, and QR contents. |
| `npm run test:db` | 79 SQL security checks pass against a throw-away Postgres 16 (needs `psql`). |
| `npm run build` | Production build succeeds. |

**QR contents.** The test generates the PNG, decodes it with an independent QR reader (jsQR) and requires the decoded text to equal the configured URL exactly. The PNG downloaded from the running admin endpoint was decoded the same way.

**Security tests.** `supabase/tests/security.sql` covers three actors:

- *Anonymous:* only published + consented profiles are visible; unapproved social links never appear; the raw table, consent columns and `admin_users` are refused; no writes anywhere; storage shows only the photo of a published volunteer.
- *Signed-in non-admin:* sees nothing and can write nothing, cannot make themselves an admin, and a JWT/user metadata claiming `admin` changes nothing.
- *Administrator:* full CRUD on volunteers and teams, cannot publish without consent, cannot delete a team that still has volunteers, cannot create admins through the API, can upload/replace/delete photos, and unsafe object names are rejected.

Plus data-integrity checks (slug format, unique slugs and team names, unsafe or unknown social links, skill and bio limits, photo folder ownership, consent rules, publish timestamps).

To confirm the suite can actually fail, two regressions were introduced on purpose and both were caught: granting `anon` the raw `social_links` column, and making `is_admin()` trust JWT metadata. The correct migrations were restored afterwards.

## Browser tests against a local stand-in (not part of `npm test`)

The app was built and run in production mode and driven with Playwright/Chromium against the **real PostgREST** and the real migrations. Auth and Storage were **mocks** written for the purpose (see `tests/e2e-local/README.md`); the mock storage authorised every request through the real `storage.objects` policies.

- Public site: 42 checks passed (directory, search as you type, case-insensitive and multi-word search, `%` treated literally, team filter, pagination and out-of-range pages, profile page, unapproved link absent from HTML, photo served for a published volunteer and refused for an unpublished one, real 404 status for unknown profiles, security headers, no cookies, signed-out redirects, no horizontal overflow at 390 px width).
- Admin: 55 checks passed (non-admin refused, wrong password, dashboard counts, publish blocked without consent, create with validation errors that keep typed values and selections, unique slugs, upload preview, non-image and over-5 MB rejection, upload, replace with old file removed, remove, consent and publish flow, withdrawing consent forces unpublish, delete confirmation, team create/rename/duplicate/delete rules, QR page and downloads, sign-out).

## Not tested

- **Real Supabase Auth and Storage.** Login, session refresh, and the browser-to-Storage upload were exercised only against mocks. The upload uses the same multipart shape as the Supabase client library, but confirm it with one real upload on your project (docs/SUPABASE-SETUP.md, step 5).
- **A real deployment on Vercel**, including environment variables and the custom domain.
- **The GitHub Actions workflow** (`.github/workflows/ci.yml`) has not been run.
- **Real devices and browsers:** only Chromium (desktop size and a 390 px phone viewport) was used. Scanning a *printed* QR code was not done; the code was verified by decoding the generated image.
- **Accessibility audit:** built with labels, focus states, semantic landmarks and reduced-motion support, but not reviewed with a screen reader or an automated audit tool.
- **Load and performance testing.** Search uses a trigram index and returns one page at a time, which is sized for hundreds to low thousands of volunteers.
