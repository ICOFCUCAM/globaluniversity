-- ===========================================================================
-- 068 — THE COURSE AS A PLACE TO LEARN
-- ===========================================================================
--
-- WHAT CHANGES FOR THE UNIVERSITY THE MOMENT THIS RUNS
--
-- NOTHING IS DELETED AND NOTHING IS REFUSED. A course gains somewhere to keep
-- what is taught in it — an outline, learning outcomes, and materials attached
-- week by week — and a student gains a shelf of the courses they are actually
-- registered on.
--
-- Nothing is seeded. No outline is invented, no reading list is guessed at.
--
-- ---------------------------------------------------------------------------
-- THE UNIVERSITY'S OBJECTION, WHICH THIS ANSWERS
-- ---------------------------------------------------------------------------
--
-- "The LMS should NOT be called a Learning Management System if it isn't
-- actually an LMS… The current LMS looks like a file repository containing:
-- Introduction to AI, SQL Tutorial, React Framework, Neural Networks. Those
-- examples don't even appear connected to the University's actual academic
-- programmes."
--
-- The invented rows were removed months ago. The deeper fault was not the
-- content — it was the SHAPE. Materials lived in `module_records`, a JSON blob
-- store, keyed on a course code typed in as free text. So:
--
--   · a material naming 'BIS 220' matched no course, because a string is not a
--     foreign key;
--   · nothing could list the materials OF a course, only search for a string;
--   · a student could not be shown "my courses", because no material knew
--     which offering, which term or which cohort it belonged to;
--   · and a lecturer's own courses could not be gathered at all.
--
-- A course_id fixes every one of those at once.
--
-- ---------------------------------------------------------------------------
-- WHY A MATERIAL POINTS AT A COURSE AND *OPTIONALLY* AT AN OFFERING
-- ---------------------------------------------------------------------------
--
-- The distinction the University drew, applied one level further down.
--
-- A course outline, a reading list and a set of learning outcomes belong to
-- the COURSE. They are true in 2026 and in 2029, and re-uploading them every
-- August is how a reading list comes to differ between two terms of the same
-- course for no reason anybody intended.
--
-- A lecture recording, a week's slides and a class announcement belong to the
-- OFFERING. They are this term's.
--
-- So `offering_id` is nullable, and that null MEANS SOMETHING: the material
-- stands for every term the course runs. A screen showing an offering shows
-- both; a screen showing the catalogue entry shows only the first.
-- ===========================================================================


-- ===========================================================================
-- 0. THE MIGRATIONS THIS ONE NEEDS
-- ===========================================================================

do $$
begin
  if to_regclass('public.course_offerings') is null then
    raise exception
      'Migration 063 has not been run on this database: there are no course offerings for a '
      'term''s materials to belong to. Run 063_the_offering_and_the_class.sql first, or run the '
      'whole bundle.';
  end if;
end $$;


-- ===========================================================================
-- 1. WHAT A COURSE TEACHES
-- ===========================================================================
--
-- `courses.description` has existed since 001 and is the prospectus sentence.
-- These two are different things and a University distinguishes them:
--
--   THE OUTLINE is what will be covered, week by week. It is what a student
--   reads to know what they are in for.
--
--   THE LEARNING OUTCOMES are what they will be able to do afterwards. They
--   are what an examiner writes a paper against and what an accreditor asks
--   to see, and they are the reason this is a separate column rather than more
--   prose in the description.
--
-- BOTH NULLABLE. Not one course in this University has either recorded, and
-- inventing them would be inventing what the University teaches.

alter table courses
  add column if not exists outline           text,
  add column if not exists learning_outcomes text;

comment on column courses.outline is
  'What the course covers, week by week. Distinct from `description`, which is the prospectus '
  'sentence. Null until the University writes one — an invented outline is an invented course.';

comment on column courses.learning_outcomes is
  'What a student can do after passing. What an examiner writes a paper against and what an '
  'accreditor asks to see, which is why it is not more prose in the description.';


-- ===========================================================================
-- 2. THE MATERIALS THEMSELVES
-- ===========================================================================

create table if not exists course_materials (
  id           uuid primary key default gen_random_uuid(),

  -- A FOREIGN KEY, NOT A TYPED-IN CODE. This is the whole of the fix: a
  -- material naming 'BIS 220' as a string matched no course and could not be
  -- listed, filtered or counted. ON DELETE CASCADE because a material for a
  -- course that no longer exists is a file nobody can reach through any screen.
  course_id    uuid not null references courses (id) on delete cascade,

  -- THIS TERM'S, OR EVERY TERM'S. Null means the material belongs to the
  -- COURSE and stands for every term it runs — see the file header. ON DELETE
  -- CASCADE would destroy a recording when a term is tidied away, so a
  -- cancelled offering releases its materials back to the course instead.
  offering_id  uuid references course_offerings (id) on delete set null,

  kind         text not null default 'note'
                 check (kind in ('outline', 'reading', 'note', 'slides', 'video',
                                 'link', 'recording', 'announcement')),

  -- THE TEACHING WEEK, where the material belongs to one. Null for anything
  -- that stands outside the weekly rhythm: the reading list, the outline.
  week         integer check (week is null or week between 1 and 52),

  title        text not null check (length(btrim(title)) between 1 and 300),
  body         text,
  url          text,

  -- VISIBLE TO STUDENTS, OR NOT YET. A lecturer preparing week 9 in week 2
  -- must be able to keep it back; without this they keep it on their own
  -- computer, which is where it stays when they are ill.
  visible      boolean not null default true,

  sort_order   integer not null default 0,
  created_by   uuid references auth.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  -- A MATERIAL IS SOMETHING TO READ, WATCH OR OPEN. One with neither a body
  -- nor a link is a title on a page that does nothing when clicked, and a
  -- student cannot tell it from a broken one.
  constraint course_materials_have_something
    check (body is not null or url is not null)
);

create index if not exists course_materials_by_course
  on course_materials (course_id, week, sort_order);
create index if not exists course_materials_by_offering
  on course_materials (offering_id) where offering_id is not null;

comment on table course_materials is
  'What is taught in a course: outline, reading, notes, slides, video, recordings. Keyed to the '
  'course by FOREIGN KEY rather than by a typed-in code — a material naming ''BIS 220'' as a '
  'string matched no course and could be searched for but never listed. `offering_id` null means '
  'the material belongs to the course and stands for every term it runs.';

-- AND THE OFFERING MUST BE OF THE COURSE. Without this a material can name
-- BIS 220 and point at an offering of OT 300, and the week 3 slides appear on
-- somebody else's course.
create or replace function refuse_a_material_on_the_wrong_course()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  offered uuid;
begin
  if new.offering_id is null then return new; end if;
  select course_id into offered from course_offerings where id = new.offering_id;
  if offered is distinct from new.course_id then
    raise exception
      'This material names one course and an offering of another. It would appear on the wrong '
      'course''s page.'
      using errcode = 'check_violation';
  end if;
  return new;
end $$;

drop trigger if exists course_materials_match_the_offering on course_materials;
create trigger course_materials_match_the_offering
  before insert or update on course_materials
  for each row execute function refuse_a_material_on_the_wrong_course();


-- ===========================================================================
-- 3. MY COURSES — THE SHELF A STUDENT OPENS
-- ===========================================================================
--
-- The University asked for it in these words: "My Programmes → My Courses →
-- inside BIS 220: course overview, lecturer, outline, weekly materials…"
--
-- THE SHELF IS THE REGISTRATIONS, not the catalogue. A student's courses are
-- the ones they are registered on this term — which is a question that could
-- not be asked before 063 linked a registration to an offering, because
-- "registered on BIS 220" named no term, no lecturer and no class.
--
-- `security_invoker` AND `auth.uid()`: the view returns the signed-in
-- student's own courses and nobody else's, and it does so in the database
-- rather than by a screen remembering to filter. A screen that forgets is a
-- screen that shows one student another's timetable.

create or replace view my_courses
with (security_invoker = true) as
select s.id                    as student_id,
       c.id                    as course_id,
       c.code                  as course_code,
       c.title                 as course_title,
       c.credit_unit,
       c.description,
       c.outline,
       c.learning_outcomes,
       o.id                    as offering_id,
       o.term_sequence,
       o.delivery_mode,
       o.campus,
       o.status                as offering_status,
       y.label                 as year_label,
       y.starts_in,
       l.id                    as lecturer_id,
       coalesce(l.first_name || ' ' || l.last_name, null) as lecturer,
       e.id                    as enrollment_id,
       e.academic_year,
       e.semester,
       e.status                as registration_status,
       -- HOW MUCH THERE IS TO READ. Counted here so a shelf can show it
       -- without a second query per course — and so a course with nothing in
       -- it says nothing rather than looking broken.
       (select count(*) from course_materials m
         where m.course_id = c.id
           and m.visible
           and (m.offering_id is null or m.offering_id = o.id))  as materials
  from enrollments e
  join students s on s.id = e.student_id
  join courses c on c.id = e.course_id
  left join course_offerings o on o.id = e.offering_id
  left join academic_years y on y.id = o.academic_year_id
  left join lecturers l on l.id = o.lecturer_id
 where e.status = 'registered'
   and s.auth_user_id = auth.uid();

comment on view my_courses is
  'The signed-in student''s own courses: what they are registered on, who teaches it this term, '
  'and how much material there is. Filtered by auth.uid() in the DATABASE rather than by a screen '
  'remembering to — a screen that forgets shows one student another''s courses.';


-- ===========================================================================
-- 4. AND THE COURSES A LECTURER TEACHES
-- ===========================================================================
--
-- The same question from the other side, and equally unanswerable before 063:
-- `courses.lecturer_id` says who teaches a course FOREVER, in every year and
-- on every campus, which is the mistake 063 was written to correct. The
-- offering says who teaches it THIS TERM.
--
-- BOTH ARE READ, and that is deliberate rather than untidy. Until the
-- University sets up a term, `courses.lecturer_id` is the only record of who
-- teaches what, and a lecturer whose shelf was empty until somebody built an
-- offering would conclude the system had lost their courses.

create or replace view my_teaching
with (security_invoker = true) as
with mine as (
  -- ---- WHAT THEY ARE OFFERING THIS TERM -------------------------------
  select l.id              as lecturer_id,
         c.id              as course_id,
         c.code            as course_code,
         c.title           as course_title,
         c.credit_unit,
         o.id              as offering_id,
         o.term_sequence,
         o.status          as offering_status,
         o.delivery_mode,
         y.label           as year_label,
         y.starts_in,
         'offering'::text  as attached_by
    from lecturers l
    join course_offerings o on o.lecturer_id = l.id
    join courses c on c.id = o.course_id
    join academic_years y on y.id = o.academic_year_id
   -- THE ACCOUNT, BY `auth_user_id` AND NOT BY EMAIL. Written first as
   -- `join profiles p on p.email = l.email`, which silently returns NOTHING
   -- for any lecturer whose sign-in address differs from the one on their
   -- staff record — and a shelf that is empty for a reason nobody can see is
   -- worse than one that errors. 001 put the column here for this.
   where l.auth_user_id = auth.uid()

  union all

  -- ---- AND WHAT THE CATALOGUE STILL SAYS THEY TEACH --------------------
  --
  -- `courses.lecturer_id` says who teaches a course FOREVER — the mistake 063
  -- was written to correct. It is read anyway, and only where no offering of
  -- that course names them, because until the University sets up a term it is
  -- the ONLY record of who teaches what. A lecturer whose shelf was empty
  -- until somebody built an offering would conclude the system had lost their
  -- courses.
  select l.id, c.id, c.code, c.title, c.credit_unit,
         null::uuid, null::integer, null::text, null::text, null::text, null::integer,
         'catalogue'::text
    from lecturers l
    join courses c on c.lecturer_id = l.id
   where l.auth_user_id = auth.uid()
     and not exists (
       select 1 from course_offerings o2
        where o2.course_id = c.id and o2.lecturer_id = l.id)
)
select m.*,
       (select count(*) from course_materials mt
         where mt.course_id = m.course_id
           and (mt.offering_id is null or mt.offering_id = m.offering_id))  as materials,
       (select count(*) from enrollments e
         where e.status = 'registered'
           and (case when m.offering_id is not null then e.offering_id = m.offering_id
                     else e.course_id = m.course_id end))                   as registered
  from mine m;

comment on view my_teaching is
  'The signed-in lecturer''s courses, from their offerings this term AND from courses.lecturer_id '
  'where no term has been set up. `attached_by` says which, because a lecturer whose shelf was '
  'empty until somebody built an offering would conclude the system had lost their courses. '
  'Matched on lecturers.auth_user_id, not on email: an email match returns nothing, silently, for '
  'anybody whose sign-in address differs from their staff record.';


-- ===========================================================================
-- 5. WHO CAN READ AND WRITE A MATERIAL
-- ===========================================================================
--
-- A MATERIAL IS FOR THE CLASS, NOT FOR THE WORLD. `course_offerings` is
-- readable by anybody — what is on offer is a prospectus — but a lecture
-- recording is not.
--
-- Every signed-in member of the University may read a visible material. That
-- is wider than "only the registered students" on purpose: a student deciding
-- whether to take a course next term should be able to see its outline and
-- reading list, and an examiner marking it needs the same. A material a
-- lecturer is still preparing is `visible = false` and is nobody's but the
-- offices that manage courses.

alter table course_materials enable row level security;

drop policy if exists course_materials_read on course_materials;
create policy course_materials_read on course_materials
  for select using (
    (visible and auth.uid() is not null)
    or auth_role() in ('superadmin', 'admin', 'registrar', 'academic-office',
                       'dean', 'hod', 'programme-coordinator', 'lecturer')
  );

-- No write policy. Every change goes through /api/academic/materials.


-- ===========================================================================
-- 6. PROVE IT
-- ===========================================================================

do $$
declare
  dept     uuid;
  crs_a    uuid;
  crs_b    uuid;
  y_id     uuid;
  off_a    uuid;
  off_b    uuid;
  n        integer;
  refused  boolean;
begin
  begin
    select id into dept from departments limit 1;
    if dept is null then
      insert into departments (name, code, faculty, head_name)
        values ('Proof 068', 'P068', 'Proof', 'Nobody') returning id into dept;
    end if;

    insert into courses (code, title, credit_unit, department_id, level, semester, year)
      values ('PROOF-068-A', 'A Course With Materials', 3, dept, 100, 1, 1)
      returning id into crs_a;
    insert into courses (code, title, credit_unit, department_id, level, semester, year)
      values ('PROOF-068-B', 'Another Course Entirely', 3, dept, 100, 1, 1)
      returning id into crs_b;

    select id into y_id from academic_years order by starts_in limit 1;
    insert into course_offerings (course_id, academic_year_id, term_sequence)
      values (crs_a, y_id, 1) returning id into off_a;
    insert into course_offerings (course_id, academic_year_id, term_sequence)
      values (crs_b, y_id, 1) returning id into off_b;

    -- ---- A MATERIAL OF THE COURSE, FOR EVERY TERM -----------------------
    insert into course_materials (course_id, kind, title, body)
      values (crs_a, 'outline', 'Course outline', 'Week 1 to week 12.');

    -- ---- AND ONE OF THIS TERM ONLY --------------------------------------
    insert into course_materials (course_id, offering_id, kind, week, title, url)
      values (crs_a, off_a, 'recording', 3, 'Week 3 lecture', 'https://example.test/w3');

    select count(*) into n from course_materials where course_id = crs_a;
    if n <> 2 then
      raise exception '068 FAILED: the course has % materials, expected 2', n;
    end if;

    -- ---- A MATERIAL CANNOT NAME AN OFFERING OF ANOTHER COURSE -----------
    --
    -- PROVE THE GUARD BY BREAKING IT. Without this the week 3 slides of one
    -- course appear on the page of another.
    refused := false;
    begin
      insert into course_materials (course_id, offering_id, kind, title, url)
        values (crs_a, off_b, 'slides', 'Slides on the wrong course', 'https://example.test/x');
    exception when check_violation then
      refused := true;
    end;
    if not refused then
      raise exception
        '068 FAILED: a material was attached to an offering of a different course';
    end if;

    -- ---- A MATERIAL WITH NEITHER A BODY NOR A LINK IS REFUSED -----------
    --
    -- A title that does nothing when clicked is indistinguishable from a
    -- broken one, and a student cannot tell which.
    refused := false;
    begin
      insert into course_materials (course_id, kind, title)
        values (crs_a, 'note', 'A title and nothing else');
    exception when check_violation then
      refused := true;
    end;
    if not refused then
      raise exception '068 FAILED: a material with nothing in it was accepted';
    end if;

    -- ---- AND A WEEK OUTSIDE A YEAR IS REFUSED ---------------------------
    refused := false;
    begin
      insert into course_materials (course_id, kind, week, title, body)
        values (crs_a, 'note', 70, 'Week seventy', 'x');
    exception when check_violation then
      refused := true;
    end;
    if not refused then
      raise exception '068 FAILED: a material was filed under week 70';
    end if;

    -- ---- THE COURSE KEEPS ITS MATERIALS WHEN AN OFFERING GOES -----------
    --
    -- ON DELETE SET NULL, not cascade. A term tidied away must not destroy the
    -- recording of a lecture that was actually given — and a material whose
    -- term is gone falls back to belonging to the course, which is the
    -- sensible reading of it.
    delete from course_offerings where id = off_a;
    select count(*) into n from course_materials where course_id = crs_a;
    if n <> 2 then
      raise exception
        '068 FAILED: deleting the offering destroyed % of the course''s materials', 2 - n;
    end if;
    select count(*) into n
      from course_materials where course_id = crs_a and offering_id is null;
    if n <> 2 then
      raise exception
        '068 FAILED: a material whose offering was deleted did not fall back to the course';
    end if;

    -- ---- AND THE OUTLINE COLUMNS EXIST, EMPTY ---------------------------
    select count(*) into n
      from information_schema.columns
     where table_schema = 'public' and table_name = 'courses'
       and column_name in ('outline', 'learning_outcomes');
    if n <> 2 then
      raise exception '068 FAILED: the outline columns were not added';
    end if;

    select count(*) into n from courses
     where outline is not null or learning_outcomes is not null;
    if n <> 0 then
      raise exception
        '068 FAILED: % course(s) arrived with an outline nobody wrote. An invented outline is an '
        'invented course.', n;
    end if;

    raise notice '068 OK — materials key to a course by foreign key, a term''s material cannot '
                 'land on another course, a material with nothing in it is refused, and deleting '
                 'a term releases its materials to the course rather than destroying them.';

    raise exception 'PROOF_ROLLBACK';
  exception
    when others then
      if sqlerrm <> 'PROOF_ROLLBACK' then raise; end if;
  end;
end $$;
