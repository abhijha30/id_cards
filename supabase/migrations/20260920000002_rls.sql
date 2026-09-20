-- =============================================================================
-- GDG Noida Volunteer Directory: 2/3 access control
-- Row Level Security, column privileges and the restricted public view.
--
-- Access model
--   anon (public visitors)   read published + consent-granted volunteers (named columns only),
--                            read active teams. Nothing else. No writes.
--   authenticated, non-admin no access to any directory table (they get LESS than anon on
--                            purpose, so a self-registered account can never read more than a visitor).
--   authenticated, admin     full access to teams and volunteers. Admin = row in admin_users.
--   service_role             bypasses RLS (never used by this app).
--
-- The public website always queries with the anon key and no user session, so the
-- anon rules below are the ones that protect public data.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Admin check
-- SECURITY DEFINER so it can read admin_users without triggering admin_users' own
-- RLS policy, which avoids recursive policy evaluation. Pinned search_path.
-- It only ever answers "is the CALLING user an admin?", so exposing it is safe.
-- -----------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.admin_users a
    where a.user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- -----------------------------------------------------------------------------
-- Enable RLS on every directory table
-- -----------------------------------------------------------------------------
alter table public.admin_users enable row level security;
alter table public.teams       enable row level security;
alter table public.volunteers  enable row level security;

-- -----------------------------------------------------------------------------
-- Privileges. Supabase grants ALL on new public tables to anon/authenticated by
-- default; start from zero and grant back only what is needed. RLS then filters rows.
-- -----------------------------------------------------------------------------
revoke all on public.admin_users from anon, authenticated;
revoke all on public.teams       from anon, authenticated;
revoke all on public.volunteers  from anon, authenticated;

-- admin_users: a signed-in user may read their own row (used for the admin check).
grant select on public.admin_users to authenticated;

-- teams: all columns are public-safe.
grant select on public.teams to anon;
grant select, insert, update, delete on public.teams to authenticated;

-- volunteers: anon may read ONLY these columns. Notably absent: social_links (contains
-- unapproved URLs), consent_recorded_at, consent_version, created_at.
grant select (
  id, full_name, slug, team_id, public_role, bio, photo_path, skills,
  public_social_links, is_published, consent_status, published_at, updated_at
) on public.volunteers to anon;
grant select, insert, update, delete on public.volunteers to authenticated;

-- -----------------------------------------------------------------------------
-- Policies
-- -----------------------------------------------------------------------------

-- admin_users --------------------------------------------------------------
-- SELECT (authenticated): a user can see only their own row.
-- INSERT / UPDATE / DELETE: no policy and no grant, so denied for every API role.
--                           Admins are added via the SQL editor only.
create policy admin_users_select_own
  on public.admin_users
  for select
  to authenticated
  using (user_id = (select auth.uid()));

-- teams --------------------------------------------------------------------
-- SELECT (anon): active teams only.
create policy teams_public_read
  on public.teams
  for select
  to anon
  using (is_active);

-- ALL (authenticated): administrators only. Non-admin users match no policy => no rows, no writes.
create policy teams_admin_all
  on public.teams
  for all
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- volunteers ---------------------------------------------------------------
-- SELECT (anon): published AND consent granted only.
create policy volunteers_public_read
  on public.volunteers
  for select
  to anon
  using (is_published and consent_status = 'granted');

-- ALL (authenticated): administrators only.
create policy volunteers_admin_all
  on public.volunteers
  for all
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- -----------------------------------------------------------------------------
-- Restricted public view: the shape the website reads.
--   * security_invoker => the caller's privileges and RLS apply (no privilege escalation)
--   * only approved fields; social links come from the generated approved-only column
--   * the WHERE clause repeats the RLS rule as defence in depth
--   * LEFT JOIN: a volunteer stays listed if their team is deactivated (team shows as empty)
-- Email, phone, auth ids and admin data do not exist in this schema at all.
-- -----------------------------------------------------------------------------
create view public.public_volunteers
with (security_invoker = true)
as
select
  v.id,
  v.slug,
  v.full_name,
  v.public_role,
  v.bio,
  v.photo_path,
  v.skills,
  v.public_social_links as social_links,
  v.published_at,
  v.updated_at,
  t.id   as team_id,
  t.name as team_name,
  t.slug as team_slug
from public.volunteers v
left join public.teams t on t.id = v.team_id
where v.is_published
  and v.consent_status = 'granted';

revoke all on public.public_volunteers from anon, authenticated;
grant select on public.public_volunteers to anon;

comment on view public.public_volunteers is
  'Public directory read model. Readable by anon only; approved fields only.';
