-- ===========================================================================
-- 063 — THE OFFERING AND THE CLASS
-- ===========================================================================
--
-- WHAT CHANGES FOR THE UNIVERSITY THE MOMENT THIS RUNS
--
-- THE TWO LINKS MISSING FROM THE MIDDLE OF THE ACADEMIC CHAIN ARE BUILT. The
-- chain the University drew runs
--
--   Programme → Curriculum → Course → COURSE OFFERING → CLASS/SECTION
--     → Student Registration → Assessment → Result → Transcript → Graduation
--
-- and everything from Registration down has existed and worked for months.
-- Everything above Course now exists too, since 057. The two in the middle did
-- not exist in any form, and their absence is why four separate screens are
-- unsatisfactory at once:
--
--   COURSE REGISTRATION is "far too empty" because there was nothing to
--   register AGAINST. `enrollments` joins a student straight to a COURSE, so
--   the system cannot say who is teaching it, where, when, or how many places
--   are left — because none of that is recorded anywhere.
--
--   THE TIMETABLE cannot detect a conflict because a room was free text in a
--   JSON blob. Two blobs both saying "Room A201" are not a room.
--
--   THE LMS cannot show "My Courses" because a student belongs to no class.
--
--   AN EXAMINATION cannot have a candidate list, because a candidate list IS
--   the cohort registered on an offering.
--
-- One missing entity, four broken screens.
--
-- ---------------------------------------------------------------------------
-- A COURSE IS NOT A COURSE OFFERING, AND THIS IS THE CORRECTION
-- ---------------------------------------------------------------------------
--
-- The University put it exactly: "A course is an academic definition… That
-- course can be offered: 2026/27 — Semester 1, with lecturer, class, delivery
-- mode, campus, room, schedule, maximum enrollment, registered students."
--
--   BIS 220 Bible Survey I, 3 credits          — the COURSE. True every year.
--   BIS 220, 2026/2027 Semester 1, on campus   — the OFFERING. True once.
--   BIS 220, group A, Prof X, Room 3, Mon 08   — the CLASS. One timetable slot.
--
-- Putting a lecturer on `courses` — which is where `courses.lecturer_id` still
-- is — says the same person teaches it forever, in every year, on every
-- campus. It is the same mistake as `courses.year` and `courses.semester`,
-- which 057 moved to the curriculum entry: a fact about one PLACEMENT stored
-- against the thing placed.
--
-- ---------------------------------------------------------------------------
-- WHAT IS NOT SEEDED
-- ---------------------------------------------------------------------------
--
-- No room, no offering, no class. The University has not told this system
-- where it teaches — not one room number, capacity or building — and a
-- plausible "Room A201" is exactly the invention that ends up on a timetable a
-- student walks to. The tables arrive empty and the Superadministrator fills
-- them.
-- ===========================================================================


-- ===========================================================================
-- 1. WHERE TEACHING HAPPENS
-- ===========================================================================
--
-- A ROOM IS A ROW, and that is the whole of why conflict detection becomes
-- possible. The timetable's "room" has been free text inside a JSON blob in
-- `module_records`; two records both reading "Room A201" are two strings, and
-- no query can say they are the same place.

create table if not exists rooms (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique check (length(btrim(code)) between 1 and 32),
  name        text,
  campus      text,
  -- WHAT KIND OF SPACE, because a lecture theatre and a laboratory are not
  -- interchangeable and a timetable that treats them as such will schedule a
  -- practical into a seminar room.
  kind        text not null default 'room'
                check (kind in ('room', 'lecture-hall', 'laboratory', 'studio', 'online')),
  capacity    integer check (capacity is null or capacity > 0),
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

comment on table rooms is
  'Where the University teaches. EMPTY on arrival: not one room number, building or capacity '
  'has been stated, and an invented "Room A201" is the kind of thing a student walks to.';


-- ===========================================================================
-- 2. THE OFFERING — A COURSE, IN A TERM
-- ===========================================================================

create table if not exists course_offerings (
  id                uuid primary key default gen_random_uuid(),
  course_id         uuid not null references courses (id) on delete restrict,
  -- THE TERM, FROM THE CALENDAR. Not an integer somebody typed: 059 exists so
  -- that "which academic year is this" has one answer, and an offering is the
  -- first thing that has to agree with it.
  academic_year_id  uuid not null references academic_years (id) on delete restrict,
  term_sequence     integer not null check (term_sequence between 1 and 4),

  -- THE UNIVERSITY'S OWN THREE WORDS. Ruled: "The school is not only online.
  -- Delivery is Campus, Online, or Online / Campus — those exact words."
  delivery_mode     text not null default 'Campus'
                      check (delivery_mode in ('Campus', 'Online', 'Online / Campus')),
  campus            text,
  language          text,

  -- WHO ANSWERS FOR IT. On the offering, not the course: the person teaching
  -- BIS 220 this year is not necessarily the person who taught it last.
  lecturer_id       uuid references lecturers (id) on delete set null,

  max_enrolment     integer check (max_enrolment is null or max_enrolment > 0),
  status            text not null default 'planned'
                      check (status in ('planned', 'open', 'closed', 'cancelled')),
  created_at        timestamptz not null default now(),

  -- ONE OFFERING OF A COURSE PER TERM. Two is two capacities, two lecturers
  -- and two answers to "am I registered" — and where a University genuinely
  -- runs a course twice in a term, that is two CLASSES of one offering, which
  -- is what section 3 is for.
  unique (course_id, academic_year_id, term_sequence)
);

create index if not exists course_offerings_by_term
  on course_offerings (academic_year_id, term_sequence);

comment on table course_offerings is
  'A course as actually offered: this year, this semester, this delivery mode, this lecturer, '
  'this many places. The COURSE is the academic definition and is true every year; the offering '
  'is true once.';


-- ===========================================================================
-- 3. THE CLASS — A GROUP, A ROOM AND AN HOUR
-- ===========================================================================
--
-- An offering may be taught to more than one group, and each group meets at
-- its own time in its own place. That is the row a timetable draws, and the
-- row two of which cannot occupy one room at one hour.

create table if not exists class_sections (
  id            uuid primary key default gen_random_uuid(),
  offering_id   uuid not null references course_offerings (id) on delete cascade,
  -- 'A', 'B', 'Evening'. The University's own label for the group.
  code          text not null default 'A' check (length(btrim(code)) between 1 and 24),
  lecturer_id   uuid references lecturers (id) on delete set null,
  room_id       uuid references rooms (id) on delete set null,

  -- 1 = Monday, as ISO numbers them. Null where a class has no fixed slot,
  -- which an online cohort working asynchronously legitimately has not.
  day_of_week   integer check (day_of_week is null or day_of_week between 1 and 7),
  starts_at     time,
  ends_at       time,

  delivery_mode text check (delivery_mode is null or
                  delivery_mode in ('Campus', 'Online', 'Online / Campus')),
  online_link   text,
  capacity      integer check (capacity is null or capacity > 0),
  created_at    timestamptz not null default now(),

  unique (offering_id, code),
  constraint class_sections_run_forwards
    check (starts_at is null or ends_at is null or ends_at > starts_at),
  -- A SLOT IS A DAY AND TWO TIMES, OR NONE OF THEM. Half a slot cannot be put
  -- on a timetable and cannot be checked for a clash, so it is refused rather
  -- than stored as something that looks scheduled.
  constraint class_sections_slot_is_whole
    check ((day_of_week is null and starts_at is null and ends_at is null)
           or (day_of_week is not null and starts_at is not null and ends_at is not null))
);

create index if not exists class_sections_by_slot
  on class_sections (day_of_week, starts_at, ends_at);


-- ===========================================================================
-- 4. THE CONFLICTS, AS A QUERY
-- ===========================================================================
--
-- The University named three: "Room conflict. Lecturer conflict. Student-group
-- conflict."
--
-- The first two are answerable the moment a room and a lecturer are rows, and
-- they are answered here — once, in a view, rather than by each screen
-- inventing its own overlap arithmetic and getting the boundary wrong. Two
-- classes where one ends exactly as the other begins do NOT clash; `<` and `>`
-- rather than `<=` and `>=` is the whole of that, and it is the detail every
-- hand-written version gets wrong.
--
-- THE THIRD IS DIFFERENT AND WORTH SAYING. A student-cohort clash — two
-- compulsory courses at the same hour — is not visible in the timetable at
-- all. It is a CURRICULUM question: are these two courses both core, in the
-- same programme version, in the same year and semester? That join is below,
-- and it is only possible because 057 put year, semester and core/elective on
-- the curriculum entry.

create or replace view timetable_clashes
with (security_invoker = true) as
-- ROOM: one space, two classes, overlapping hours.
select 'room'::text                        as kind,
       a.id                                as section_id,
       b.id                                as clashes_with,
       r.code                              as detail,
       a.day_of_week, a.starts_at, a.ends_at
  from class_sections a
  join class_sections b
    on b.id <> a.id
   and b.room_id = a.room_id
   and b.day_of_week = a.day_of_week
   and b.starts_at < a.ends_at
   and b.ends_at   > a.starts_at
  join rooms r on r.id = a.room_id
 where a.room_id is not null
   and a.day_of_week is not null

union all

-- LECTURER: one person, two classes, overlapping hours.
select 'lecturer',
       a.id, b.id,
       coalesce(l.first_name || ' ' || l.last_name, 'A lecturer'),
       a.day_of_week, a.starts_at, a.ends_at
  from class_sections a
  join class_sections b
    on b.id <> a.id
   and b.lecturer_id = a.lecturer_id
   and b.day_of_week = a.day_of_week
   and b.starts_at < a.ends_at
   and b.ends_at   > a.starts_at
  join lecturers l on l.id = a.lecturer_id
 where a.lecturer_id is not null
   and a.day_of_week is not null

union all

-- COHORT: two courses a student must pass, in the same term of the same
-- programme, taught at the same hour. Nobody can attend both.
select 'cohort',
       a.id, b.id,
       p.code || ' year ' || ea.year || ' semester ' || ea.semester,
       a.day_of_week, a.starts_at, a.ends_at
  from class_sections a
  join course_offerings oa on oa.id = a.offering_id
  join curriculum_entries ea on ea.course_id = oa.course_id and ea.requirement = 'core'
  join class_sections b on b.id <> a.id
   and b.day_of_week = a.day_of_week
   and b.starts_at < a.ends_at
   and b.ends_at   > a.starts_at
  join course_offerings ob on ob.id = b.offering_id
  join curriculum_entries eb
    on eb.course_id = ob.course_id
   and eb.requirement = 'core'
   and eb.programme_version_id = ea.programme_version_id
   and eb.year = ea.year
   and eb.semester = ea.semester
  join programme_versions v on v.id = ea.programme_version_id
  join programmes p on p.id = v.programme_id
 where a.day_of_week is not null;

comment on view timetable_clashes is
  'Room, lecturer and student-cohort conflicts, computed once rather than by each screen. Two '
  'classes where one ends exactly as the other begins do not clash — the boundary every '
  'hand-written overlap check gets wrong.';


-- ===========================================================================
-- 5. A REGISTRATION IS AGAINST AN OFFERING
-- ===========================================================================
--
-- `enrollments.course_id` stays — the results pipeline, the GPA engine and the
-- graduation audit all read it, and rewriting them is not this migration's
-- job. What is added is the link that was missing: WHICH offering, and
-- therefore which lecturer, which room, which cohort and how many places.
--
-- NOT NOT-NULL, deliberately. Every existing registration was made before
-- offerings existed and cannot be given one retrospectively without inventing
-- which class a student attended.

alter table enrollments
  add column if not exists offering_id uuid references course_offerings (id) on delete restrict,
  add column if not exists section_id  uuid references class_sections (id) on delete set null;

create index if not exists enrollments_by_offering
  on enrollments (offering_id) where offering_id is not null;

-- AND THE OFFERING MUST BE OF THE COURSE REGISTERED. Without this a
-- registration can name BIS 220 and point at an offering of OT 300, and every
-- screen downstream reports a different course depending on which column it
-- happens to read.
create or replace function refuse_a_mismatched_offering()
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
      'This registration names one course and an offering of another. Every screen downstream '
      'would report whichever of the two it happened to read.'
      using errcode = 'check_violation';
  end if;

  -- AND THE SECTION MUST BELONG TO THAT OFFERING.
  if new.section_id is not null
     and not exists (select 1 from class_sections
                      where id = new.section_id and offering_id = new.offering_id) then
    raise exception
      'This registration names a class that is not part of the offering it is registered to.'
      using errcode = 'check_violation';
  end if;

  return new;
end $$;

drop trigger if exists enrollments_offering_matches_course on enrollments;
create trigger enrollments_offering_matches_course
  before insert or update on enrollments
  for each row execute function refuse_a_mismatched_offering();


-- ===========================================================================
-- 6. WHAT IS ON OFFER, AND HOW FULL
-- ===========================================================================

create or replace view course_offering_roll
with (security_invoker = true) as
select o.id                 as offering_id,
       c.code               as course_code,
       c.title              as course_title,
       c.credit_unit,
       y.label              as year_label,
       y.starts_in,
       o.term_sequence,
       o.delivery_mode,
       o.campus,
       o.status,
       o.max_enrolment,
       l.first_name || ' ' || l.last_name        as lecturer,
       (select count(*) from class_sections s where s.offering_id = o.id)  as classes,
       (select count(*) from enrollments e
         where e.offering_id = o.id and e.status = 'registered')           as registered,
       -- PLACES LEFT, or null where no ceiling was set. Null is not zero, and
       -- a screen that treats it as zero closes a course nobody limited.
       case when o.max_enrolment is null then null
            else o.max_enrolment - (select count(*) from enrollments e
                                     where e.offering_id = o.id and e.status = 'registered')
       end                                                                 as places_left
  from course_offerings o
  join courses c on c.id = o.course_id
  join academic_years y on y.id = o.academic_year_id
  left join lecturers l on l.id = o.lecturer_id;

comment on view course_offering_roll is
  'Every offering with its lecturer, its classes and how full it is. `places_left` is null where '
  'no ceiling was set — null is not zero, and a screen reading it as zero closes a course nobody '
  'limited.';


-- ===========================================================================
-- 7. WHO CAN READ IT
-- ===========================================================================
--
-- WHAT IS ON OFFER IS PUBLIC. A prospective student comparing universities
-- should be able to see that a course runs in Semester 1, on campus, and what
-- it is worth — that is a prospectus, and hiding it serves nobody.
--
-- WHO IS REGISTERED IS NOT, and that is already true: `enrollments` carries
-- its own policy and this migration does not touch it.

alter table rooms            enable row level security;
alter table course_offerings enable row level security;
alter table class_sections   enable row level security;

drop policy if exists course_offerings_read on course_offerings;
create policy course_offerings_read on course_offerings
  for select using (
    status in ('open', 'closed')
    or auth_role() in ('superadmin', 'admin', 'registrar', 'academic-office',
                       'vice-chancellor', 'chancellor', 'dean', 'hod',
                       'programme-coordinator', 'lecturer')
  );

drop policy if exists class_sections_read on class_sections;
create policy class_sections_read on class_sections
  for select using (auth.uid() is not null);

-- A ROOM NUMBER IS NOT A SECRET, and a timetable is unreadable without one.
drop policy if exists rooms_read on rooms;
create policy rooms_read on rooms for select using (auth.uid() is not null);

-- No write policy on any of the three. Every change goes through the API.


-- ===========================================================================
-- 8. PROVE IT
-- ===========================================================================

do $$
declare
  y_id     uuid;
  room_a   uuid;
  room_b   uuid;
  lect     uuid;
  crs_a    uuid;
  crs_b    uuid;
  off_a    uuid;
  off_b    uuid;
  sec_a    uuid;
  sec_b    uuid;
  stu      uuid;
  n        integer;
  refused  boolean;
begin
  begin
    select id into y_id from academic_years where status = 'current';
    if y_id is null then select id into y_id from academic_years order by starts_in limit 1; end if;

    insert into rooms (code, name, capacity) values ('PROOF-1', 'A Proof Room', 40)
      returning id into room_a;
    insert into rooms (code, name, capacity) values ('PROOF-2', 'Another Proof Room', 40)
      returning id into room_b;
    -- `staff_id` is NOT NULL on this table; a proof that omitted it would fail
    -- for a reason that has nothing to do with this migration.
    insert into lecturers (staff_id, first_name, last_name, email)
      values ('PROOF-063', 'A', 'Proof-Lecturer', '063-lecturer@example.test')
      returning id into lect;
    insert into courses (code, title, credit_unit) values ('PRF 601', 'A Proof Course', 5)
      on conflict (code) do nothing;
    select id into crs_a from courses where code = 'PRF 601';
    insert into courses (code, title, credit_unit) values ('PRF 602', 'Another Proof Course', 5)
      on conflict (code) do nothing;
    select id into crs_b from courses where code = 'PRF 602';

    insert into course_offerings (course_id, academic_year_id, term_sequence, delivery_mode,
                                  lecturer_id, max_enrolment, status)
      values (crs_a, y_id, 1, 'Campus', lect, 2, 'open') returning id into off_a;

    -- ---- ONE OFFERING OF A COURSE PER TERM --------------------------------
    refused := false;
    begin
      insert into course_offerings (course_id, academic_year_id, term_sequence)
        values (crs_a, y_id, 1);
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '063 FAILED: one course was offered twice in one term';
    end if;

    -- ---- HALF A TIMETABLE SLOT IS REFUSED ---------------------------------
    -- A day with no times cannot be drawn and cannot be checked for a clash.
    refused := false;
    begin
      insert into class_sections (offering_id, code, day_of_week) values (off_a, 'X', 1);
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '063 FAILED: a class was scheduled on a day with no hours';
    end if;

    insert into class_sections (offering_id, code, lecturer_id, room_id,
                                day_of_week, starts_at, ends_at)
      values (off_a, 'A', lect, room_a, 1, time '08:00', time '10:00') returning id into sec_a;

    -- ---- A ROOM HOLDS ONE CLASS AT A TIME ---------------------------------
    insert into course_offerings (course_id, academic_year_id, term_sequence, status)
      values (crs_b, y_id, 1, 'open') returning id into off_b;
    insert into class_sections (offering_id, code, room_id, day_of_week, starts_at, ends_at)
      values (off_b, 'A', room_a, 1, time '09:00', time '11:00') returning id into sec_b;

    select count(*) into n from timetable_clashes
     where kind = 'room' and section_id in (sec_a, sec_b);
    if n = 0 then
      raise exception '063 FAILED: two classes in one room at one hour were not reported';
    end if;

    -- AND A CLASS THAT ENDS EXACTLY AS ANOTHER BEGINS DOES NOT CLASH. This is
    -- the boundary every hand-written overlap check gets wrong.
    update class_sections set starts_at = time '10:00', ends_at = time '12:00' where id = sec_b;
    select count(*) into n from timetable_clashes
     where kind = 'room' and section_id in (sec_a, sec_b);
    if n > 0 then
      raise exception '063 FAILED: back-to-back classes were reported as a clash';
    end if;

    -- ---- AND A LECTURER IS IN ONE PLACE -----------------------------------
    update class_sections set lecturer_id = lect, room_id = room_b,
           starts_at = time '09:00', ends_at = time '11:00' where id = sec_b;
    select count(*) into n from timetable_clashes
     where kind = 'lecturer' and section_id in (sec_a, sec_b);
    if n = 0 then
      raise exception '063 FAILED: one lecturer in two rooms at one hour was not reported';
    end if;

    -- ---- A REGISTRATION CANNOT NAME TWO DIFFERENT COURSES -----------------
    insert into auth.users (id, email) values (gen_random_uuid(), '063-student@example.test');
    insert into students (first_name, last_name, email, matric_no)
      values ('A', 'Proof-Student', '063-student@example.test', 'PROOF-063')
      returning id into stu;

    refused := false;
    begin
      insert into enrollments (student_id, course_id, academic_year, semester, status, offering_id)
        values (stu, crs_b, 2026, 1, 'registered', off_a);
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '063 FAILED: a registration named one course and an offering of another';
    end if;

    -- AND A CLASS MUST BELONG TO THE OFFERING REGISTERED TO.
    refused := false;
    begin
      insert into enrollments (student_id, course_id, academic_year, semester, status,
                               offering_id, section_id)
        values (stu, crs_a, 2026, 1, 'registered', off_a, sec_b);
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '063 FAILED: a registration named a class from a different offering';
    end if;

    -- ---- AND THE ROLL COUNTS WHAT IS THERE --------------------------------
    insert into enrollments (student_id, course_id, academic_year, semester, status,
                             offering_id, section_id)
      values (stu, crs_a, 2026, 1, 'registered', off_a, sec_a);

    select registered into n from course_offering_roll where offering_id = off_a;
    if n <> 1 then
      raise exception '063 FAILED: the roll counts % registered, not 1', n;
    end if;
    select places_left into n from course_offering_roll where offering_id = off_a;
    if n <> 1 then
      raise exception '063 FAILED: places left is %, not 1 of 2', n;
    end if;

    -- NO CEILING IS NOT A FULL COURSE. A screen reading null as zero would
    -- close a course nobody limited.
    update course_offerings set max_enrolment = null where id = off_a;
    select places_left into n from course_offering_roll where offering_id = off_a;
    if n is not null then
      raise exception '063 FAILED: an unlimited offering reports % places left', n;
    end if;

    raise exception 'PROOF_ROLLBACK';
  exception
    when others then
      if sqlerrm <> 'PROOF_ROLLBACK' then raise; end if;
  end;

  raise notice '063 OK: a course is offered once per term, and a registration cannot name one '
               'course and an offering of another';
  raise notice '063 OK: a room holds one class at a time and a lecturer is in one place — and '
               'back-to-back classes are NOT reported as a clash';
  raise notice '063 OK: half a timetable slot is refused, and the roll counts who is registered '
               'without reading an unlimited offering as a full one';
end $$;


-- ===========================================================================
-- 9. VERIFY — READ THIS OUTPUT
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- EMPTY, AND THAT IS CORRECT. The University has not said where it teaches:
-- not one room number, building or capacity. Nothing here is seeded, because
-- an invented "Room A201" is the kind of thing a student walks to.
-- ---------------------------------------------------------------------------
select (select count(*) from rooms)             as rooms,
       (select count(*) from course_offerings)  as offerings,
       (select count(*) from class_sections)    as classes,
       (select count(*) from enrollments where offering_id is not null)
                                                as registrations_against_an_offering;

-- ---------------------------------------------------------------------------
-- AND NOTHING CLASHES, because nothing is scheduled. This is the query the
-- timetable will run on every change: room, lecturer and student-cohort
-- conflicts, in one place.
-- ---------------------------------------------------------------------------
select kind, count(*) as conflicts from timetable_clashes group by kind;
