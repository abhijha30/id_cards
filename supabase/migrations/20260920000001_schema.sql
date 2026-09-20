-- =============================================================================
-- GDG Noida Volunteer Directory: 1/3 schema
-- Tables, constraints, indexes and triggers. Access control lives in migration 2
-- (RLS + grants) and migration 3 (storage).
-- =============================================================================

-- pg_trgm powers fast case-insensitive "contains" search on volunteer names.
-- Supabase keeps extensions in the `extensions` schema.
create schema if not exists extensions;
create extension if not exists pg_trgm with schema extensions;

-- -----------------------------------------------------------------------------
-- Shared trigger: keep updated_at fresh
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- admin_users: the ONLY source of truth for who is an administrator.
-- Rows are created by a project owner through the SQL editor (see README).
-- Never derived from user-editable metadata.
-- -----------------------------------------------------------------------------
create table public.admin_users (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

comment on table public.admin_users is
  'Administrators. Managed only via the SQL editor / service role. No API role can write to it.';

-- -----------------------------------------------------------------------------
-- teams
-- -----------------------------------------------------------------------------
create table public.teams (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null,
  description text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint teams_slug_key unique (slug),
  constraint teams_name_length check (char_length(btrim(name)) between 2 and 60),
  constraint teams_slug_format check (
    slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 60
  ),
  constraint teams_description_length check (description is null or char_length(description) <= 300)
);

create unique index teams_name_lower_key on public.teams (lower(btrim(name)));

create trigger teams_set_updated_at
  before update on public.teams
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Validation helpers used by CHECK constraints (immutable, no table access)
-- -----------------------------------------------------------------------------

-- At most 15 skills, each 1-40 characters.
create or replace function public.is_valid_skills(skills text[])
returns boolean
language sql
immutable
parallel safe
set search_path = ''
as $$
  select coalesce(cardinality(skills), 0) <= 15
     and not exists (
       select 1
       from unnest(skills) as s
       where s is null or char_length(btrim(s)) not between 1 and 40
     );
$$;

-- social_links shape:
--   { "linkedin": { "url": "https://...", "approved": true }, ... }
-- Allowed keys: linkedin, instagram, github, youtube, x, website.
-- URLs must be https, at most 300 characters, and must not contain credentials.
create or replace function public.is_valid_social_links(links jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  k   text;
  v   jsonb;
  url text;
begin
  if links is null or jsonb_typeof(links) is distinct from 'object' then
    return false;
  end if;

  for k, v in select e.key, e.value from jsonb_each(links) as e loop
    if k not in ('linkedin', 'instagram', 'github', 'youtube', 'x', 'website') then
      return false;
    end if;
    if jsonb_typeof(v) is distinct from 'object' then
      return false;
    end if;
    if jsonb_typeof(v -> 'url') is distinct from 'string'
       or jsonb_typeof(v -> 'approved') is distinct from 'boolean' then
      return false;
    end if;
    if (v - 'url' - 'approved') <> '{}'::jsonb then
      return false;
    end if;

    url := v ->> 'url';
    if char_length(url) > 300 or url !~* '^https://[^\s/?#@]+([/?#][^\s]*)?$' then
      return false;
    end if;
  end loop;

  return true;
end;
$$;

-- Only the approved links, reduced to { platform: url }. Feeds the generated
-- public_social_links column so anonymous roles never see unapproved URLs.
create or replace function public.approved_social_links(links jsonb)
returns jsonb
language sql
immutable
parallel safe
set search_path = ''
as $$
  select coalesce(
    jsonb_object_agg(e.key, e.value ->> 'url') filter (where e.value -> 'approved' = 'true'::jsonb),
    '{}'::jsonb
  )
  from jsonb_each(coalesce(links, '{}'::jsonb)) as e;
$$;

-- -----------------------------------------------------------------------------
-- volunteers
-- -----------------------------------------------------------------------------
create table public.volunteers (
  id                  uuid primary key default gen_random_uuid(),
  full_name           text not null,
  slug                text not null,
  team_id             uuid references public.teams (id) on delete restrict,
  public_role         text,
  bio                 text,
  -- Object name inside the private `volunteer-photos` bucket: <volunteer id>/<uuid>.<jpg|png|webp>
  photo_path          text,
  skills              text[] not null default '{}',
  -- Admin-only source data, including per-link approval flags.
  social_links        jsonb not null default '{}'::jsonb,
  -- Derived: approved links only. This is the column the public can read.
  public_social_links jsonb generated always as (public.approved_social_links(social_links)) stored,
  is_published        boolean not null default false,
  consent_status      text not null default 'pending',
  consent_recorded_at timestamptz,
  consent_version     text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  published_at        timestamptz,

  constraint volunteers_slug_key unique (slug),
  constraint volunteers_full_name_length check (char_length(btrim(full_name)) between 2 and 100),
  constraint volunteers_slug_format check (
    slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 80
  ),
  constraint volunteers_public_role_length check (public_role is null or char_length(public_role) <= 100),
  constraint volunteers_bio_length check (bio is null or char_length(bio) <= 600),
  constraint volunteers_photo_path_format check (
    photo_path is null or photo_path ~ (
      '^' || id::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$'
    )
  ),
  constraint volunteers_skills_valid check (public.is_valid_skills(skills)),
  constraint volunteers_social_links_valid check (public.is_valid_social_links(social_links)),
  constraint volunteers_consent_status_valid check (consent_status in ('pending', 'granted', 'withdrawn')),
  constraint volunteers_consent_recorded check (
    consent_status <> 'granted' or (consent_recorded_at is not null and consent_version is not null)
  ),
  -- A profile can only be public while consent is granted.
  constraint volunteers_publish_requires_consent check (not is_published or consent_status = 'granted'),
  constraint volunteers_published_at_set check (not is_published or published_at is not null)
);

comment on column public.volunteers.social_links is
  'Admin-only. Each entry carries an "approved" flag; only approved URLs reach public_social_links.';
comment on column public.volunteers.public_social_links is
  'Generated: approved social URLs only. The only social column granted to the anon role.';

-- Search + listing indexes
create index volunteers_full_name_trgm_idx
  on public.volunteers using gin (full_name extensions.gin_trgm_ops);

create index volunteers_public_listing_idx
  on public.volunteers (full_name, id)
  where is_published and consent_status = 'granted';

create index volunteers_team_id_idx on public.volunteers (team_id);

-- Timestamps and publication bookkeeping
create or replace function public.volunteers_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();

  if tg_op = 'UPDATE' then
    new.created_at := old.created_at;
  end if;

  if new.is_published then
    if tg_op = 'INSERT' then
      new.published_at := coalesce(new.published_at, now());
    elsif not old.is_published then
      new.published_at := now();
    else
      new.published_at := coalesce(new.published_at, old.published_at, now());
    end if;
  else
    new.published_at := null;
  end if;

  return new;
end;
$$;

create trigger volunteers_before_write
  before insert or update on public.volunteers
  for each row execute function public.volunteers_before_write();
