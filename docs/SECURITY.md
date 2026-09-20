# Security model

The rules are enforced in the database (Row Level Security, column privileges) and repeated in the server code. The UI is not trusted to enforce anything.

## Who can do what

| Role | Directory data | Photos | Admin data |
| --- | --- | --- | --- |
| **Anonymous visitor** (`anon`) | Read `public_volunteers`: published volunteers with consent granted, approved fields only. Read active teams. | Read a photo only while its volunteer is published with consent granted. | Nothing. |
| **Signed-in, not an admin** (`authenticated`) | Nothing. They get *less* than a visitor on purpose, so a self-registered account can never read more than the public can. | Nothing. | Nothing. Cannot promote themselves. |
| **Administrator** (row in `admin_users`) | Full read/write on volunteers and teams. | Upload, replace, delete, read all. | Can read only their own `admin_users` row. |
| **Service role** | Bypasses RLS. **Not used by this app.** | | |

## Policies and grants (migration 2 and 3)

- `is_admin()`: `SECURITY DEFINER`, pinned `search_path`, reads `admin_users` for `auth.uid()`. Avoids recursive policy evaluation and never looks at JWT or user metadata.
- `admin_users`: RLS on; authenticated users may `SELECT` only their own row; no insert/update/delete policy or grant exists, so admins are added from the SQL editor only.
- `teams`: `anon` may `SELECT` active rows; admins have `ALL`.
- `volunteers`: `anon` may `SELECT` only published + consent-granted rows and only **named columns**. The raw `social_links` column (which contains links that have *not* been approved), `consent_recorded_at`, `consent_version` and `created_at` are not granted to `anon`. Admins have `ALL`.
- `volunteers.public_social_links`: a generated column holding only the links marked approved. It is the only social column the public can read.
- `public_volunteers` view: `security_invoker`, granted to `anon` only. Exposes approved fields only and repeats the publish and consent rule in its `WHERE` clause.
- Storage bucket `volunteer-photos`: private; 5 MB and JPEG/PNG/WebP enforced by the bucket itself. Object names must match `<uuid>/<uuid>.<jpg|png|webp>`, which blocks path traversal and odd extensions. `anon` may read an object only if `is_public_volunteer_photo()` finds a published, consented volunteer pointing at it.
- Database constraints: publishing requires granted consent; granted consent records when and under which notice version; URLs must be `https`, at most 300 characters, and free of credentials; only known social platforms; at most 15 skills; bio at most 600 characters; a volunteer's `photo_path` must sit in their own folder.

## Application controls

- `requireAdmin()` runs in every admin page, route handler and server action (server actions are public endpoints, so a layout check alone would not protect them). It validates the session with Supabase Auth (`getUser()`), then checks `admin_users`.
- `proxy.ts` only refreshes cookies and redirects signed-out visitors early; it does not grant access.
- Sign-in verifies admin membership and signs non-admins straight back out.
- Post-login redirects are restricted to `/admin/...` (no open redirect). Notices shown after an action come from a fixed message catalogue, never from raw query-string text.
- All form input is validated with Zod on the server. Social links are additionally checked against per-platform host lists at save time and re-checked at render time.
- Uploads: the browser checks size and the file's real signature (magic bytes), uploads with the admin's own session (so storage RLS decides), then a server action confirms the stored object's size and content type before attaching it. The original filename is never used.
- Withdrawing consent while a profile is published forces it back to unpublished.
- External links open with `rel="noopener noreferrer nofollow ugc"`. React escapes all text.
- Response headers: Content-Security-Policy (with `frame-ancestors 'none'`, `object-src 'none'`, `base-uri` and `form-action` limited to self), HSTS, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`.
- Public pages set no cookies and load no third-party scripts, fonts or analytics (fonts are self-hosted).

## Known limits

- **Sign-in throttling** relies on Supabase Auth's built-in rate limits; the app adds none of its own.
- **No in-app multi-factor authentication.** Use long unique passwords, keep the administrator list short, and consider Supabase's MFA options if your risk warrants it.
- **No audit log** of who changed what.
- **The CSP allows inline scripts** (`'unsafe-inline'`), because Next.js needs them without per-request nonces. The other directives still limit what an injected script could do.
- **Photo caching:** an unpublished person's photo can stay visible in caches for up to 5 minutes.
- **Abandoned uploads:** if a browser closes mid-upload, an unreferenced file can remain in the private bucket. The app tries to clean up on failure but does not sweep for strays.
- **The public view of a photo URL** contains the volunteer's slug, so anyone who knows a profile URL can fetch the photo while it is published; that is the point of the directory.

## Reporting a problem

Add a contact or `SECURITY.md` in the repository root with the address organisers want vulnerability reports sent to before making the repository public.
