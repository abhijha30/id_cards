# Deployment: GitHub and Vercel

Nothing here has been done for you: no repository was created and nothing was deployed. These are the steps to do it yourselves.

## 1. Put the code on GitHub

Create an empty repository named `gdg-noida-volunteer-directory` in the GitHub account or organisation you want (decide first whether it should be private or public; see the privacy checklist), then from the project folder:

```bash
git init
git add .
git commit -m "Initial commit: GDG Noida volunteer directory"
git branch -M main
git remote add origin git@github.com:<owner>/gdg-noida-volunteer-directory.git
git push -u origin main
```

With the GitHub CLI you can do it in one go (use `--public` only if you mean it):

```bash
gh repo create <owner>/gdg-noida-volunteer-directory --private --source=. --remote=origin --push
```

`.gitignore` already excludes `node_modules`, `.next`, every `.env*` file except `.env.example`, and `*.zip`. Never commit real keys.

## 2. Deploy on Vercel

1. In Vercel choose **Add New > Project** and import the GitHub repository.
2. Framework preset: **Next.js** (auto-detected). Leave the build and output settings alone. Node.js 22 or newer.
3. Add these **Environment Variables** (Production, and Preview if you use previews):

   | Name | Value |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | your Supabase project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | your Supabase anon / publishable key |
   | `NEXT_PUBLIC_SITE_URL` | the final public address, e.g. `https://<your-domain>` |
   | `NEXT_PUBLIC_CONTACT_EMAIL` | optional, shown on the privacy page |

4. Deploy.
5. Add your custom domain under **Settings > Domains**, wait for HTTPS to be issued, then confirm `NEXT_PUBLIC_SITE_URL` matches it exactly and **redeploy** (these values are compiled in at build time).

Do not invent or guess the production domain. The QR code will encode whatever `NEXT_PUBLIC_SITE_URL` says.

## 3. After the first deploy

- Sign in at `/admin/login` and check the **Overview** page shows counts (not an error).
- Add a test volunteer, upload a photo, grant consent, publish, and open the public profile on your phone.
- Unpublish or delete the test volunteer.

## 4. Production checklist before printing ID cards

- [ ] `NEXT_PUBLIC_SITE_URL` is the final `https://` domain, and the site loads there.
- [ ] `/admin/qr` shows **no warnings** and lists that exact address.
- [ ] Downloaded the **SVG** for the print shop (PNG for screens).
- [ ] Printed one card and scanned it with two different phones.
- [ ] Sign-ups disabled in Supabase Auth; at least two administrators exist, so one person leaving cannot lock everyone out.
- [ ] The approved GDG Noida logo is in place (`BRAND_LOGO_SRC`), replacing the neutral placeholder.
- [ ] The privacy page has been reviewed, its `CONSENT_VERSION` no longer says "draft", and the contact address is set.
- [ ] The decisions in [PRIVACY-CHECKLIST.md](PRIVACY-CHECKLIST.md) have been made.

## Caching note

Public pages are rendered per request, so unpublishing a profile hides it immediately. Photos are the exception: `/photos/[slug]` may be cached by browsers and Vercel's CDN for up to 5 minutes, so an unpublished person's photo can remain visible for that long.
