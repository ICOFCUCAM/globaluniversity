-- ===========================================================================
-- ICOF GLOBAL UNIVERSITY — WHAT IS OPEN FOR ADMISSION
--
-- Run after 007_gpa_engine.sql. Idempotent; destroys nothing.
--
-- ---------------------------------------------------------------------------
-- WHY
--
-- The application form offered every award level and every field of study the
-- university has ever taught, permanently. An applicant could apply in March
-- for an intake that does not open until September, to a programme the faculty
-- is not running this year, or to one it has stopped running altogether — and
-- nothing anywhere would refuse it. The application arrived, somebody in
-- Admissions read it, and somebody had to write back and explain.
--
-- That cost falls on the applicant, who waited; on the Admissions Office, which
-- handled a file it could never approve; and on the university, which looks
-- disorganised at precisely the moment it is being judged.
--
-- The Head of Academic Affairs decides what the university is ready to teach.
-- This table is where that decision is recorded, and the form reads it.
--
-- ---------------------------------------------------------------------------
-- WHY EVERY ROW IS SEEDED OPEN
--
-- Because the alternative silently closes admissions.
--
-- If the form treated "no row" as "not open", then the moment this migration
-- ran — before anyone had opened anything — the application form would offer an
-- empty list and every applicant would be turned away by a system nobody had
-- told to turn anyone away. A change that closes the front door of the
-- university as a side effect of being deployed is not an acceptable change.
--
-- So every level and field currently on the form is seeded open. Nothing
-- changes until the Head of Academic Affairs unchecks something, which is the
-- correct default: the migration records the present state and gives somebody
-- the ability to change it.
--
-- The same reasoning governs the form's behaviour when this table is ABSENT
-- entirely: it shows everything, exactly as it did before. A missing table is a
-- migration not yet run, not an instruction to close admissions.
-- ===========================================================================


-- ===========================================================================
-- 1. THE TABLE
-- ===========================================================================

create table if not exists admission_openings (
  id          uuid primary key default gen_random_uuid(),

  -- 'level'  — an award level, e.g. 'Bachelor of Science'
  -- 'field'  — a field of study, e.g. 'Software Engineering'
  --
  -- Two kinds in one table because the form asks two questions and either can
  -- be closed independently: a university may run every field but admit only to
  -- the diploma this year, or teach at every level but suspend one department.
  kind        text not null check (kind in ('level', 'field')),

  -- The exact string the form shows. Matching on the label rather than on an id
  -- is deliberate: the form's options are content, not database rows, and a
  -- lookup table of ids would have to be kept in step with them by hand — which
  -- is the arrangement that eventually shows an applicant an option that leads
  -- nowhere.
  label       text not null,

  -- The group the field belongs to, for the admin screen. Null for levels.
  faculty     text,

  -- The decision. False removes it from the application form.
  open        boolean not null default true,

  -- Optional guidance shown to staff, e.g. 'Not running 2026/27'.
  note        text,

  updated_by  uuid,
  updated_at  timestamptz not null default now(),

  unique (kind, label)
);

create index if not exists admission_openings_open_idx on admission_openings (open);


-- ===========================================================================
-- 2. SEED — everything the form offers today, all open
-- ===========================================================================

insert into admission_openings (kind, label, faculty) values
  ('level', 'Doctor of Philosophy',       null),
  ('level', 'Doctor of Theology',         null),
  ('level', 'Master of Arts',             null),
  ('level', 'Bachelor of Science',        null),
  ('level', 'Diploma',                    null),
  ('level', 'Certificate',                null),

  ('field', 'Theology',                   'Theology'),
  ('field', 'Divinity',                   'Theology'),
  ('field', 'Ministry',                   'Theology'),
  ('field', 'Christian Leadership',       'Theology'),
  ('field', 'Christian Education',        'Theology'),
  ('field', 'Evangelism and Mission',     'Theology'),
  ('field', 'Black Liberation Theology',  'Theology'),
  ('field', 'Primary Education',          'Education'),
  ('field', 'Special Education',          'Education'),
  ('field', 'Software Engineering',       'Engineering'),
  ('field', 'Networking',                 'Engineering'),
  ('field', 'Business Management',        'Business'),
  ('field', 'Project Management',         'Business')
on conflict (kind, label) do nothing;


-- ===========================================================================
-- 3. RLS
--
-- PUBLIC READ, and that is not an oversight. The application form is on the
-- open web and is used by people who have no account — it cannot ask which
-- programmes are open if reading the answer requires signing in.
--
-- What is public is a list of what the university is currently admitting to.
-- That is information the university publishes anyway, on the prospectus and on
-- every programme page.
--
-- NO WRITE POLICY. Only the service role writes, and the only thing holding it
-- is /api/admissions/openings, which is guarded by capability. Admissions being
-- open is an academic decision, not a row somebody can edit from a browser
-- console.
-- ===========================================================================

alter table admission_openings enable row level security;

drop policy if exists admission_openings_public_read on admission_openings;
create policy admission_openings_public_read on admission_openings
  for select using (true);


-- ===========================================================================
-- 4. VERIFY
-- ===========================================================================

select kind, count(*) filter (where open) as open, count(*) as total
from admission_openings group by kind order by kind;

select kind, label, open, note from admission_openings order by kind, faculty nulls first, label;


-- ===========================================================================
-- AFTER RUNNING THIS
--
-- Nothing changes for applicants: everything is seeded open, which is the state
-- the form was already in.
--
-- The Head of Academic Affairs closes and opens programmes in
-- Settings → Admission openings. An unchecked programme disappears from the
-- application form immediately; it is not hidden from the prospectus, because
-- "we are not admitting to this now" and "we do not teach this" are different
-- statements and the site should not conflate them.
-- ===========================================================================
