# Supabase setup

Time needed: about 15 minutes.

## 1. Create the project

1. Sign in at supabase.com and create a new project. Choose a region close to your visitors (for India, a Mumbai or Singapore region).
2. Save the database password somewhere safe. The app does not need it.
3. Open **Project Settings > API** (called *Data API* / *API Keys* in newer dashboards) and copy:
   - the **Project URL** into `NEXT_PUBLIC_SUPABASE_URL`
   - the **anon** or **publishable** key into `NEXT_PUBLIC_SUPABASE_ANON_KEY`

   Do not copy the `service_role` / secret key anywhere. This app does not use it.

## 2. Apply the database migrations

Run the three files in `supabase/migrations/` **in order**.

**Option A: SQL editor (simplest).** Open **SQL Editor > New query**, paste the contents of each file, and run:

1. `20260920000001_schema.sql`
2. `20260920000002_rls.sql`
3. `20260920000003_storage.sql`

**Option B: Supabase CLI.**

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

Then, optionally, run `supabase/seed.sql` for example teams (Core Team, Technical, Design, Community, Operations). They are placeholders; rename or delete them from the admin dashboard.

After migration 3, **Storage** should show a private bucket named `volunteer-photos` (5 MB limit, JPEG/PNG/WebP only).

## 3. Lock down sign-ups

The site has no public sign-up page, but Supabase Auth allows sign-ups by default. Turn it off so nobody can create accounts:

**Authentication > Sign In / Providers > Email**: switch **Allow new users to sign up** off.

Even if this were left on, a new account cannot do anything: administrators are only the users listed in the `admin_users` table.

## 4. Create the first administrator

1. **Authentication > Users > Add user > Create new user.** Enter the email and a strong password, and tick **Auto Confirm User**.
2. In the **SQL Editor**, promote that user (replace the address):

```sql
insert into public.admin_users (user_id)
select id from auth.users where email = 'organiser@example.org';
```

3. Check it worked:

```sql
select u.email from public.admin_users a join auth.users u on u.id = a.user_id;
```

To add or remove administrators later, repeat step 2, or `delete from public.admin_users where user_id = ...`. This is deliberately only possible from the SQL editor. No app screen and no API role can change the list.

## 5. Sign in

Set the environment variables (`.env.local` locally, Project Settings on Vercel), start the app, and open `/admin/login`. Sign in with the administrator account, then:

1. Add or adjust teams at **/admin/teams**.
2. Add a volunteer, then upload their photo on the next screen.
3. Set consent to *Granted* only after the volunteer has agreed, then publish.

## 6. (Optional) Run the security tests on your project

`supabase/tests/security.sql` checks the anonymous, non-admin and admin rules. Paste it into the SQL editor and run it. It works inside one transaction that is rolled back, so no data is kept, but it does create temporary users and rows while it runs, so prefer a staging project. A passing run ends with `All N security checks passed.` A failure raises an error listing the failed checks.

## Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| Public page says the directory could not be loaded | Migrations not applied, or wrong URL/key in the environment. |
| Login says "not an administrator" | The user exists but has no row in `admin_users` (step 4). |
| Photo upload says you are not allowed | You are not signed in as an administrator, or migration 3 was not applied. |
| Admin overview shows "counts could not be loaded" | Migrations not applied. |
| QR page says the code cannot be created | `NEXT_PUBLIC_SITE_URL` is not set; set it and redeploy. |
