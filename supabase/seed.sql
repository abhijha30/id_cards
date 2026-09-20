-- =============================================================================
-- Optional starter data. Run once in the Supabase SQL editor (or automatically by
-- `supabase db reset` locally). These are EXAMPLE team names: rename, remove or
-- replace them from /admin/teams to match how GDG Noida is actually organised.
-- =============================================================================
insert into public.teams (name, slug, description) values
  ('Core Team',   'core-team',   'Chapter leads and organisers.'),
  ('Technical',   'technical',   'Workshops, study jams and technical content.'),
  ('Design',      'design',      'Brand, visuals and event design.'),
  ('Community',   'community',   'Member experience and outreach.'),
  ('Operations',  'operations',  'Logistics and on-ground event operations.')
on conflict (slug) do nothing;
