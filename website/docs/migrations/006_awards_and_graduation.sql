-- ===========================================================================
-- ICOF GLOBAL UNIVERSITY — THE AWARDS, AND WHAT EARNS THEM
--
-- Run after 005_senate_approval.sql. Idempotent; destroys nothing.
--
-- ---------------------------------------------------------------------------
-- WHY
--
-- The Certificate Generator hard-coded 'Bachelor of Science' for every graduate
-- of a university that does not teach a Bachelor of Science, and printed the
-- word "Eligible" beside a check that computed nothing. Both were placeholders
-- from the template this system started as, and both survived because nothing
-- in the database said what the university actually confers or what earns it.
--
-- So the award title was free text typed by whoever pressed the button, and
-- eligibility was a word. This table is the answer to both: it names the awards,
-- and it states the credit requirement and the minimum cumulative GPA for each.
-- After this, "issue a certificate" can become "issue a certificate the
-- regulations permit", which is a different act.
--
-- ---------------------------------------------------------------------------
-- WHERE THE FIGURES COME FROM, AND WHICH ARE THE UNIVERSITY'S TO CONFIRM
--
-- The Bachelor of Theology is stated at 180 ECTS on the university's own
-- programme page, and the Diploma at 120. Those two are the university's.
--
-- The minimum CGPA for each award is NOT published anywhere in the material
-- this system was built from. 1.00 is seeded — the lowest passing grade point
-- on the university's own scale, so it excludes only a candidate who has failed
-- outright, and it will not silently withhold a degree from someone entitled to
-- one. It is marked `cgpa_confirmed = false` and the Certificate Generator says
-- so on screen. A university that wants a higher bar sets it here, deliberately,
-- rather than discovering the system had invented one.
-- ===========================================================================


-- ===========================================================================
-- 1. THE AWARDS
-- ===========================================================================

create table if not exists awards (
  id               uuid primary key default gen_random_uuid(),

  -- Short code, used in the credential number: IGUC-BTH-26A9-...
  code             text not null unique,
  title            text not null,

  -- Which kind of instrument it is. The certificate's wording follows this —
  -- a diploma is not a degree and the document must not call it one, and a
  -- doctorate is not classified. See src/lib/awards.ts.
  kind             text not null check (kind in
                     ('doctorate', 'masters', 'bachelors', 'diploma', 'certificate')),

  faculty          text,

  -- What earns it.
  credits_required integer not null check (credits_required > 0),
  min_cgpa         numeric(3,2) not null default 1.00 check (min_cgpa >= 0 and min_cgpa <= 4),

  -- False until the university states the figure. The Generator shows the
  -- distinction, because a threshold the system invented and a threshold the
  -- Senate set should not look the same to the person issuing a degree.
  cgpa_confirmed   boolean not null default false,

  -- Withdrawn awards stay on the table. A degree conferred in 2019 under a
  -- programme the university has since closed is still a degree, and its
  -- certificate must still be renderable.
  active           boolean not null default true,

  created_at       timestamptz not null default now()
);

create index if not exists awards_active_idx on awards (active, title);

-- The two the university has published curricula for. `on conflict do nothing`
-- so re-running this never overwrites a figure the university has since set.
--
-- DTH IS 120. It was seeded here at 120, changed to 180 on an instruction, and
-- has now been ruled back to 120 by the university: "Diploma is 120. 180 is
-- degree." This file carries the ruling for FRESH installs only.
--
-- Because of the `on conflict do nothing` above, RE-RUNNING THIS FILE WILL NOT
-- CORRECT A DATABASE THAT ALREADY HAS THE OLD ROW. That is the clause working
-- as intended — it exists so a figure the university has since set by hand is
-- never overwritten by a re-run — and it is why the correction is applied by
-- migration 012 instead of here.
--
-- Do not "fix" this by changing it to `do update`. That would make every
-- re-run of this file silently reset any credit value the registry has set,
-- which is a far worse failure than the one it would save.
insert into awards (code, title, kind, faculty, credits_required, min_cgpa, cgpa_confirmed)
values
  ('BTH', 'Bachelor of Theology', 'bachelors', 'Faculty of Theology', 180, 1.00, false),
  ('DTH', 'Diploma of Theology',  'diploma',   'Faculty of Theology', 120, 1.00, false)
on conflict (code) do nothing;


-- ===========================================================================
-- 2. WHICH AWARD A STUDENT IS READING FOR
--
-- `students.program` is free text — it holds whatever the application form
-- collected. That is fine for a prospectus and useless for deciding whether
-- somebody has finished: "BTh", "B.Th", "Bachelor of Theology" and "Theology"
-- are four strings and one programme.
-- ===========================================================================

alter table students
  add column if not exists award_id uuid references awards (id) on delete set null;

create index if not exists students_award_idx on students (award_id);


-- ===========================================================================
-- 3. RLS
--
-- The award catalogue is public. It is on the prospectus already, and a
-- credential evaluator reading a certificate should be able to look up what the
-- award requires without an account.
-- ===========================================================================

alter table awards enable row level security;

drop policy if exists awards_public_read on awards;
create policy awards_public_read on awards for select using (true);

-- No write policy: with RLS on and none, only the service role writes. The
-- credit requirement for a degree is not something an administrator changes
-- from a browser.


-- ===========================================================================
-- 4. VERIFY
-- ===========================================================================

select code, title, kind, credits_required, min_cgpa, cgpa_confirmed
from awards order by kind, title;

-- How many students are linked to an award. Zero on a fresh install; every
-- graduating student needs one before a certificate can be issued to them.
select count(*) filter (where award_id is not null) as linked,
       count(*)                                     as total
from students;


-- ===========================================================================
-- AFTER RUNNING THIS
--
-- 1. Add any other awards the university confers. The two seeded here are the
--    two with published curricula; the prospectus lists faculties of Education,
--    Engineering and Business whose awards are not specified anywhere this
--    system could read.
--
-- 2. Set min_cgpa for each award if the university has a rule. The seeded 1.00
--    excludes only an outright failure, which is the safe direction to be wrong
--    in — but it is the system's figure, not the Senate's, until you change it:
--
--      update awards set min_cgpa = 2.00, cgpa_confirmed = true where code = 'BTH';
--
-- 3. Link graduating students to their award:
--
--      update students set award_id = (select id from awards where code = 'BTH')
--      where program ilike '%theology%' and degree_type ilike '%bachelor%';
-- ===========================================================================
