-- =============================================================================
-- GDG Noida Volunteer Directory: 3/3 photo storage
--
-- Bucket `volunteer-photos` is PRIVATE. Objects are named
--   <volunteer uuid>/<random uuid>.<jpg|png|webp>
--
--   admins   insert / update / delete / read every photo
--   anon     read a photo ONLY while a published, consent-granted volunteer references it
--   others   nothing
--
-- The bucket itself also enforces a 5 MB limit and an image MIME allow-list on the
-- server, independent of any browser-side checks.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'volunteer-photos',
  'volunteer-photos',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public             = false,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Is this object the current photo of a publicly visible volunteer?
-- SECURITY DEFINER so the check does not depend on the caller's table privileges.
create or replace function public.is_public_volunteer_photo(object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.volunteers v
    where v.photo_path = object_name
      and v.is_published
      and v.consent_status = 'granted'
  );
$$;

revoke all on function public.is_public_volunteer_photo(text) from public;
grant execute on function public.is_public_volunteer_photo(text) to anon, authenticated;

-- Policies on storage.objects ------------------------------------------------

-- SELECT (anon): only photos of published, consented volunteers.
create policy volunteer_photos_public_read
  on storage.objects
  for select
  to anon
  using (
    bucket_id = 'volunteer-photos'
    and public.is_public_volunteer_photo(name)
  );

-- SELECT (authenticated): administrators read every photo (dashboard previews).
create policy volunteer_photos_admin_read
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'volunteer-photos' and (select public.is_admin()));

-- INSERT (authenticated): administrators only, and only with a safe object name.
create policy volunteer_photos_admin_insert
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'volunteer-photos'
    and (select public.is_admin())
    and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$'
  );

-- UPDATE (authenticated): administrators only.
create policy volunteer_photos_admin_update
  on storage.objects
  for update
  to authenticated
  using (bucket_id = 'volunteer-photos' and (select public.is_admin()))
  with check (bucket_id = 'volunteer-photos' and (select public.is_admin()));

-- DELETE (authenticated): administrators only.
create policy volunteer_photos_admin_delete
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'volunteer-photos' and (select public.is_admin()));
