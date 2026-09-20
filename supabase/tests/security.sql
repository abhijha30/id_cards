-- =============================================================================
-- Reproducible security tests: anonymous, authenticated non-admin, administrator.
--
-- HOW TO RUN
--   * Real Supabase project: paste this whole file into the SQL editor and run it.
--     Everything happens inside one transaction that is ROLLED BACK at the end, so
--     no data is left behind. Run it on a staging project if you can.
--   * Local / CI: `npm run test:db` (see scripts/test-db.sh).
--
-- The script raises an exception (and lists the failures) if any check fails.
-- =============================================================================
begin;

-- ---- tiny assertion toolkit -------------------------------------------------
create schema tap;
grant usage on schema tap to anon, authenticated;

create table tap.results (
  n           serial primary key,
  ok          boolean not null,
  description text not null
);
grant select, insert on tap.results to anon, authenticated;
grant usage, select on sequence tap.results_n_seq to anon, authenticated;

-- expects the statement to fail with the given SQLSTATE
create function tap.throws(stmt text, expected_state text, description text)
returns void language plpgsql as $$
begin
  execute stmt;
  insert into tap.results (ok, description)
  values (false, description || ' -- expected SQLSTATE ' || expected_state || ' but it succeeded');
exception when others then
  insert into tap.results (ok, description)
  values (sqlstate = expected_state, description || ' -- SQLSTATE ' || sqlstate);
end $$;

-- expects the statement to be blocked: permission error OR zero rows changed
create function tap.denied(stmt text, description text)
returns void language plpgsql as $$
declare n bigint;
begin
  execute stmt;
  get diagnostics n = row_count;
  insert into tap.results (ok, description)
  values (n = 0, description || ' -- rows changed: ' || n);
exception
  when insufficient_privilege then
    insert into tap.results (ok, description) values (true, description || ' -- denied (42501)');
  when others then
    insert into tap.results (ok, description)
    values (false, description || ' -- unexpected error ' || sqlstate || ': ' || sqlerrm);
end $$;

-- expects the statement to change exactly N rows
create function tap.changes(stmt text, expected bigint, description text)
returns void language plpgsql as $$
declare n bigint;
begin
  execute stmt;
  get diagnostics n = row_count;
  insert into tap.results (ok, description)
  values (n = expected, description || ' -- rows changed: ' || n);
exception when others then
  insert into tap.results (ok, description)
  values (false, description || ' -- error ' || sqlstate || ': ' || sqlerrm);
end $$;

-- expects a single-number query to return N
create function tap.count_is(stmt text, expected bigint, description text)
returns void language plpgsql as $$
declare n bigint;
begin
  execute stmt into n;
  insert into tap.results (ok, description)
  values (n = expected, description || ' -- got ' || coalesce(n::text, 'null') || ', expected ' || expected);
exception when others then
  insert into tap.results (ok, description)
  values (false, description || ' -- error ' || sqlstate || ': ' || sqlerrm);
end $$;

-- ---- fixtures (created as the privileged setup role) -------------------------
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'admin-one@example.test'),
  ('00000000-0000-0000-0000-0000000000a3', 'admin-two@example.test'),
  ('00000000-0000-0000-0000-0000000000b2', 'plain-user@example.test');

insert into public.admin_users (user_id) values
  ('00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-0000000000a3');

insert into public.teams (id, name, slug, is_active) values
  ('11111111-1111-1111-1111-111111111111', 'Technical', 'technical', true),
  ('22222222-2222-2222-2222-222222222222', 'Retired Team', 'retired-team', false);

-- V1 published + consented, one approved and one UNAPPROVED social link, has a photo
-- V2 consented but unpublished, has a photo
-- V3 consent pending, unpublished
-- V4 published + consented, but in an inactive team
insert into public.volunteers
  (id, full_name, slug, team_id, public_role, bio, photo_path, skills, social_links,
   is_published, consent_status, consent_recorded_at, consent_version)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Ada Lovelace', 'ada-lovelace',
   '11111111-1111-1111-1111-111111111111', 'Workshop lead', 'Analytical engines.',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1.jpg',
   array['maths', 'writing'],
   '{"linkedin": {"url": "https://www.linkedin.com/in/ada", "approved": true},
     "instagram": {"url": "https://www.instagram.com/secret-ada", "approved": false}}'::jsonb,
   true, 'granted', now(), 'test-v1'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Grace Hopper', 'grace-hopper',
   '11111111-1111-1111-1111-111111111111', 'Compiler fan', null,
   'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb/b2b2b2b2-b2b2-b2b2-b2b2-b2b2b2b2b2b2.png',
   '{}', '{}'::jsonb, false, 'granted', now(), 'test-v1'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Alan Turing', 'alan-turing',
   '11111111-1111-1111-1111-111111111111', null, null, null,
   '{}', '{}'::jsonb, false, 'pending', null, null),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'Katherine Johnson', 'katherine-johnson',
   '22222222-2222-2222-2222-222222222222', 'Navigator', null, null,
   '{}', '{}'::jsonb, true, 'granted', now(), 'test-v1');

insert into storage.objects (bucket_id, name) values
  ('volunteer-photos', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1.jpg'),
  ('volunteer-photos', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb/b2b2b2b2-b2b2-b2b2-b2b2-b2b2b2b2b2b2.png');

-- =============================================================================
-- 1. ANONYMOUS VISITOR
-- =============================================================================
set local "request.jwt.claims" = '{"role":"anon"}';
set local role anon;

do $$
begin
  perform tap.count_is('select count(*) from public.public_volunteers', 2,
    'anon: directory view lists only published + consented volunteers');
  perform tap.count_is($q$select count(*) from public.public_volunteers where slug in ('grace-hopper','alan-turing')$q$, 0,
    'anon: unpublished and consent-pending profiles are invisible');
  perform tap.count_is($q$select count(*) from public.public_volunteers
      where slug = 'ada-lovelace' and social_links ? 'linkedin' and not (social_links ? 'instagram')$q$, 1,
    'anon: only APPROVED social links are exposed');
  perform tap.count_is($q$select count(*) from public.public_volunteers where social_links::text ilike '%secret-ada%'$q$, 0,
    'anon: unapproved social URL never appears in public data');
  perform tap.count_is($q$select count(*) from public.public_volunteers where full_name ilike '%LOVE%'$q$, 1,
    'anon: case-insensitive name search works');
  perform tap.count_is($q$select count(*) from public.public_volunteers where team_slug = 'technical'$q$, 1,
    'anon: team filter works');
  perform tap.count_is($q$select count(*) from public.public_volunteers where slug = 'katherine-johnson' and team_name is null$q$, 1,
    'anon: inactive team name is not disclosed');

  perform tap.throws('select social_links from public.volunteers', '42501',
    'anon: cannot read raw social_links (with unapproved URLs) from the base table');
  perform tap.throws('select * from public.volunteers', '42501',
    'anon: SELECT * on base table is refused (consent columns are not granted)');
  perform tap.throws('select consent_version from public.volunteers', '42501',
    'anon: cannot read consent_version');
  perform tap.count_is('select count(id) from public.volunteers', 2,
    'anon: base-table RLS still limits rows to published + consented');

  perform tap.count_is('select count(*) from public.teams', 1, 'anon: only active teams are readable');
  perform tap.count_is($q$select count(*) from public.teams where slug = 'retired-team'$q$, 0,
    'anon: inactive team is hidden');

  perform tap.throws('select * from public.admin_users', '42501', 'anon: cannot read admin_users');
  perform tap.count_is('select public.is_admin()::int', 0, 'anon: is_admin() is false');

  perform tap.denied($q$insert into public.volunteers (full_name, slug) values ('Mallory', 'mallory')$q$,
    'anon: cannot insert volunteers');
  perform tap.denied($q$update public.volunteers set full_name = 'Hacked'$q$, 'anon: cannot update volunteers');
  perform tap.denied($q$update public.volunteers set is_published = true where slug = 'alan-turing'$q$,
    'anon: cannot publish a volunteer');
  perform tap.denied('delete from public.volunteers', 'anon: cannot delete volunteers');
  perform tap.denied($q$insert into public.teams (name, slug) values ('Evil', 'evil')$q$, 'anon: cannot insert teams');
  perform tap.denied($q$update public.teams set name = 'Hacked'$q$, 'anon: cannot update teams');
  perform tap.denied('delete from public.teams', 'anon: cannot delete teams');
  perform tap.denied($q$insert into public.admin_users (user_id) values ('00000000-0000-0000-0000-0000000000b2')$q$,
    'anon: cannot grant admin');

  -- storage
  perform tap.count_is($q$select count(*) from storage.objects where bucket_id = 'volunteer-photos'$q$, 1,
    'anon: can read only the photo of a published + consented volunteer');
  perform tap.denied($q$insert into storage.objects (bucket_id, name)
      values ('volunteer-photos', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/c3c3c3c3-c3c3-c3c3-c3c3-c3c3c3c3c3c3.jpg')$q$,
    'anon: cannot upload photos');
  perform tap.denied($q$update storage.objects set name = name$q$, 'anon: cannot update photos');
  perform tap.denied('delete from storage.objects', 'anon: cannot delete photos');
end $$;

reset role;

-- =============================================================================
-- 2. AUTHENTICATED NON-ADMIN (e.g. someone who signed up but was never made admin)
--    The JWT below even carries "admin" in its metadata: that must grant nothing.
-- =============================================================================
update auth.users
   set raw_app_meta_data  = '{"role":"admin","is_admin":true}'::jsonb,
       raw_user_meta_data = '{"role":"admin","is_admin":true}'::jsonb
 where id = '00000000-0000-0000-0000-0000000000b2';

set local "request.jwt.claims" = '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated","app_metadata":{"role":"admin","is_admin":true},"user_metadata":{"role":"admin","is_admin":true}}';
set local role authenticated;

do $$
begin
  perform tap.count_is('select public.is_admin()::int', 0,
    'non-admin: is_admin() is false even when JWT/user metadata claims admin');
  perform tap.count_is('select count(*) from public.volunteers', 0,
    'non-admin: sees no volunteer rows (gets less than a visitor, by design)');
  perform tap.count_is('select count(*) from public.teams', 0, 'non-admin: sees no team rows');
  perform tap.count_is('select count(*) from public.admin_users', 0,
    'non-admin: cannot see admin_users rows (not even their own, they have none)');
  perform tap.throws('select * from public.public_volunteers', '42501',
    'non-admin: the public view is granted to anon only');

  perform tap.denied($q$insert into public.volunteers (full_name, slug) values ('Mallory', 'mallory')$q$,
    'non-admin: cannot insert volunteers');
  perform tap.denied($q$update public.volunteers set full_name = 'Hacked'$q$, 'non-admin: cannot update volunteers');
  perform tap.denied($q$update public.volunteers set is_published = true$q$, 'non-admin: cannot publish');
  perform tap.denied('delete from public.volunteers', 'non-admin: cannot delete volunteers');
  perform tap.denied($q$insert into public.teams (name, slug) values ('Evil', 'evil')$q$, 'non-admin: cannot insert teams');
  perform tap.denied($q$update public.teams set name = 'Hacked'$q$, 'non-admin: cannot update teams');
  perform tap.denied('delete from public.teams', 'non-admin: cannot delete teams');
  perform tap.denied($q$insert into public.admin_users (user_id) values ('00000000-0000-0000-0000-0000000000b2')$q$,
    'non-admin: cannot promote themselves to admin');
  perform tap.denied($q$update public.admin_users set user_id = user_id$q$, 'non-admin: cannot edit admin_users');
  perform tap.denied('delete from public.admin_users', 'non-admin: cannot delete admins');

  perform tap.count_is('select count(*) from storage.objects', 0, 'non-admin: cannot read any photo objects');
  perform tap.denied($q$insert into storage.objects (bucket_id, name)
      values ('volunteer-photos', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/c3c3c3c3-c3c3-c3c3-c3c3-c3c3c3c3c3c3.jpg')$q$,
    'non-admin: cannot upload photos');
  perform tap.denied('delete from storage.objects', 'non-admin: cannot delete photos');
end $$;

reset role;

-- =============================================================================
-- 3. ADMINISTRATOR
-- =============================================================================
set local "request.jwt.claims" = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
set local role authenticated;

do $$
begin
  perform tap.count_is('select public.is_admin()::int', 1, 'admin: is_admin() is true');
  perform tap.count_is('select count(*) from public.admin_users', 1,
    'admin: can read only their own admin_users row (no recursion, no listing of other admins)');
  perform tap.count_is('select count(*) from public.volunteers', 4,
    'admin: sees ALL volunteers, including unpublished and pending');
  perform tap.count_is('select count(*) from public.teams', 2, 'admin: sees active and inactive teams');
  perform tap.count_is($q$select count(*) from public.volunteers where social_links ? 'instagram'$q$, 1,
    'admin: can read unapproved social links (needed to manage them)');

  perform tap.changes($q$insert into public.teams (name, slug) values ('Design', 'design')$q$, 1, 'admin: can create a team');
  perform tap.changes($q$update public.teams set description = 'Visuals' where slug = 'design'$q$, 1, 'admin: can update a team');
  perform tap.changes($q$insert into public.volunteers (full_name, slug, team_id)
      values ('Margaret Hamilton', 'margaret-hamilton', '11111111-1111-1111-1111-111111111111')$q$, 1,
    'admin: can create a volunteer');
  perform tap.changes($q$update public.volunteers set public_role = 'Mentor' where slug = 'margaret-hamilton'$q$, 1,
    'admin: can update a volunteer');
  perform tap.changes($q$update public.volunteers set consent_status = 'granted', consent_recorded_at = now(),
      consent_version = 'test-v1', is_published = true where slug = 'grace-hopper'$q$, 1,
    'admin: can publish a consented volunteer');
  perform tap.throws($q$update public.volunteers set is_published = true where slug = 'alan-turing'$q$, '23514',
    'admin: cannot publish without granted consent (check constraint)');
  perform tap.changes($q$delete from public.volunteers where slug = 'margaret-hamilton'$q$, 1,
    'admin: can delete a volunteer');
  perform tap.changes($q$delete from public.teams where slug = 'design'$q$, 1, 'admin: can delete an empty team');
  perform tap.throws($q$delete from public.teams where slug = 'technical'$q$, '23503',
    'admin: cannot delete a team that still has volunteers (ON DELETE RESTRICT)');

  perform tap.denied($q$insert into public.admin_users (user_id) values ('00000000-0000-0000-0000-0000000000b2')$q$,
    'admin: even admins cannot create admins through the API (SQL editor only)');

  perform tap.count_is('select count(*) from storage.objects', 2, 'admin: can read every photo incl. unpublished');
  perform tap.changes($q$insert into storage.objects (bucket_id, name)
      values ('volunteer-photos', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/c3c3c3c3-c3c3-c3c3-c3c3-c3c3c3c3c3c3.webp')$q$, 1,
    'admin: can upload a photo');
  perform tap.denied($q$insert into storage.objects (bucket_id, name)
      values ('volunteer-photos', '../../etc/passwd.jpg')$q$,
    'admin: unsafe object names are rejected by storage policy');
  perform tap.denied($q$insert into storage.objects (bucket_id, name)
      values ('volunteer-photos', 'not-a-uuid/evil.php')$q$,
    'admin: non-image / malformed object names are rejected');
  perform tap.changes($q$delete from storage.objects
      where name = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/c3c3c3c3-c3c3-c3c3-c3c3-c3c3c3c3c3c3.webp'$q$, 1,
    'admin: can delete a photo');
end $$;

reset role;

-- =============================================================================
-- 4. DATA INTEGRITY (constraints, triggers), run as the privileged setup role
-- =============================================================================
do $$
begin
  perform tap.throws($q$insert into public.volunteers (full_name, slug) values ('Bad Slug', 'Bad Slug!')$q$, '23514',
    'constraint: slug must be lowercase kebab-case');
  perform tap.throws($q$insert into public.volunteers (full_name, slug) values ('Ada Again', 'ada-lovelace')$q$, '23505',
    'constraint: slug is unique');
  perform tap.throws($q$insert into public.teams (name, slug) values ('TECHNICAL', 'technical-2')$q$, '23505',
    'constraint: team names are unique ignoring case');
  perform tap.throws($q$insert into public.volunteers (full_name, slug, social_links)
      values ('X Person', 'x-person', '{"website": {"url": "javascript:alert(1)", "approved": true}}')$q$, '23514',
    'constraint: javascript: URLs are rejected');
  perform tap.throws($q$insert into public.volunteers (full_name, slug, social_links)
      values ('X Person', 'x-person', '{"website": {"url": "http://example.com", "approved": true}}')$q$, '23514',
    'constraint: non-https URLs are rejected');
  perform tap.throws($q$insert into public.volunteers (full_name, slug, social_links)
      values ('X Person', 'x-person', '{"website": {"url": "https://user:pw@example.com", "approved": true}}')$q$, '23514',
    'constraint: URLs with embedded credentials are rejected');
  perform tap.throws($q$insert into public.volunteers (full_name, slug, social_links)
      values ('X Person', 'x-person', '{"myspace": {"url": "https://example.com", "approved": true}}')$q$, '23514',
    'constraint: unknown social platforms are rejected');
  perform tap.throws($q$insert into public.volunteers (full_name, slug, social_links)
      values ('X Person', 'x-person', '{"website": {"url": "https://example.com"}}')$q$, '23514',
    'constraint: every link needs an explicit approved flag');
  perform tap.throws($q$insert into public.volunteers (full_name, slug, skills)
      values ('X Person', 'x-person', array_fill('skill'::text, array[16]))$q$, '23514',
    'constraint: at most 15 skills');
  perform tap.throws($q$insert into public.volunteers (full_name, slug, bio)
      values ('X Person', 'x-person', repeat('a', 601))$q$, '23514',
    'constraint: bio is limited to 600 characters');
  perform tap.throws($q$update public.volunteers
      set photo_path = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb/b2b2b2b2-b2b2-b2b2-b2b2-b2b2b2b2b2b2.png'
      where slug = 'ada-lovelace'$q$, '23514',
    'constraint: a volunteer can only point at a photo in their own folder');
  perform tap.throws($q$update public.volunteers set consent_status = 'granted', consent_recorded_at = null
      where slug = 'alan-turing'$q$, '23514',
    'constraint: granted consent must record when and which version');

  -- trigger behaviour
  perform tap.count_is($q$select count(*) from public.volunteers where slug = 'grace-hopper' and published_at is not null$q$, 1,
    'trigger: published_at is set when a profile is published');
  update public.volunteers set is_published = false where slug = 'grace-hopper';
  perform tap.count_is($q$select count(*) from public.volunteers where slug = 'grace-hopper' and published_at is null$q$, 1,
    'trigger: published_at is cleared on unpublish');
end $$;

-- =============================================================================
-- Report
-- =============================================================================
do $$
declare
  r      record;
  failed int;
  total  int;
begin
  select count(*) filter (where not ok), count(*) into failed, total from tap.results;
  for r in select * from tap.results order by n loop
    raise notice '% %', case when r.ok then 'ok   ' else 'FAIL ' end, r.description;
  end loop;
  if failed > 0 then
    raise exception '% of % security checks FAILED (see notices above)', failed, total;
  end if;
  raise notice 'All % security checks passed.', total;
end $$;

rollback;
