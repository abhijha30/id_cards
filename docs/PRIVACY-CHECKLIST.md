# Privacy checklist for organisers

The software enforces consent-first publishing, but it cannot decide the policy questions below. This is not legal advice; have the wording and process checked against the data-protection rules that apply to GDG Noida (for example India's Digital Personal Data Protection Act, 2023).

## Decisions to make

- [ ] **Consent process.** How is consent collected (signed form, digital form, message)? Where is the evidence kept? The directory records *that* consent was granted, *when*, and under *which notice version*; it does not store the evidence itself.
- [ ] **Minors.** Are any volunteers under 18? If so, decide how a parent or guardian's consent is obtained before their photo and name go online.
- [ ] **Search engines.** Profiles are hidden from search engines by default (`SEARCH_ENGINE_INDEXING = false` in `lib/config.ts`, plus `robots.txt`). Decide whether volunteers understood they would be findable through Google before changing this. `robots.txt` and `noindex` are requests, not access control.
- [ ] **What may be shown.** The directory shows name, photo, team, role, bio, skills and approved links. Agree what belongs in "bio" and remind admins not to enter phone numbers, addresses or ID numbers there.
- [ ] **Social links.** Each link needs its own approval box ticked, per volunteer.
- [ ] **Removal requests.** Who answers them, how quickly, and at which address (`NEXT_PUBLIC_CONTACT_EMAIL`)? Withdraw consent in the admin screen, or delete the volunteer, when asked.
- [ ] **When volunteers leave.** Decide how long profiles stay listed after someone stops volunteering, and who unpublishes them.
- [ ] **Who is an administrator.** Everyone in `admin_users` can see and change every profile. Keep the list short and remove people who step down.
- [ ] **Photo caching.** Accept, or shorten, the up to 5 minute delay before an unpublished photo disappears from caches.
- [ ] **Repository visibility.** The repository contains no personal data, but decide whether it is public. Never commit `.env` files.

## Before launch

- [ ] Review `/privacy`, correct anything that does not match your practice, then change `CONSENT_VERSION` in `lib/config.ts` (dropping the word "draft") so the review banner disappears.
- [ ] Set `NEXT_PUBLIC_CONTACT_EMAIL`.
- [ ] Read the hosting providers' terms: Vercel (site) and Supabase (data) process visitors' IP addresses in ordinary server logs, as the privacy page says.
