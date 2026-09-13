-- ===========================================================================
-- 037 — `students.status` WAS TWO COLUMNS WEARING ONE NAME
-- ===========================================================================
--
-- ---------------------------------------------------------------------------
-- WHAT CHANGES THE MOMENT THIS RUNS. READ THIS PART.
-- ---------------------------------------------------------------------------
--
-- 1. EVERY GRADUATED, ACTIVE AND SUSPENDED ROW CHANGES ITS `status`. They
--    become `enrolled` — which is what they always were, because you cannot
--    graduate from a university you were never enrolled at — and what became of
--    them moves to the new `student_status` column. A query filtering
--    `status = 'graduated'` returns nothing after this and must read
--    `student_status` instead. The application already does.
--
-- 2. NOTHING IS LOST AND NOTHING IS GUESSED. Section 3 records every row it
--    moves, before and after, in `student_status_split`. The one genuinely
--    ambiguous value — `withdrawn` — is decided by evidence on the row rather
--    than by preference, and the rows it could not decide are reported.
--
-- 3. `students.status` GETS A CHECK CONSTRAINT FOR THE FIRST TIME. It never had
--    one. That is how three states could be written by the pipeline for years
--    while being absent from the vocabulary, and how `active` could sit in a
--    column of admission states without anything objecting. It is added NOT
--    VALID: it governs every new write immediately and does not refuse to run
--    because of a row somebody typed in 2024. 027's coverage view already
--    reports the strays.
--
-- ---------------------------------------------------------------------------
-- WHY THIS IS WORTH A MIGRATION
-- ---------------------------------------------------------------------------
--
-- Two vocabularies shared one column and two of the words appeared in both.
--
--   `withdrawn`  an applicant who wrote to say they no longer wanted the place,
--                and a student who left in their second year. 034 gave the
--                Registrar a withdrawal action that writes this word, so from
--                that day the two became genuinely indistinguishable — and one
--                of them is a place that could have gone to somebody else while
--                the other is a student who needs a transcript.
--   `deferred`   an offer held to a later intake, and something that was
--                supposed to describe a student. Only the first is real.
--
-- And it forced a worse thing. Conferring a degree set `status = 'graduated'`,
-- which OVERWROTE `enrolled`. The University's own record of having admitted
-- and enrolled somebody was destroyed by the act of graduating them.
-- ===========================================================================


-- ===========================================================================
-- 1. THE SECOND COLUMN
-- ===========================================================================
--
-- NULL until enrolment, deliberately. Somebody who has not enrolled is not yet
-- a student, and a default of 'active' would say the University teaches every
-- applicant who ever filled in the form.

alter table students add column if not exists student_status text;

comment on column students.student_status is
  'What became of this student: active, graduated, suspended or withdrawn. NULL '
  'until they enrol, because an applicant is not a student. The admission '
  'pipeline lives in `status` and is settled history once enrolment is recorded.';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'students_student_status_check') then
    alter table students add constraint students_student_status_check
      check (student_status is null
             or student_status in ('active', 'graduated', 'suspended', 'withdrawn'));
  end if;
end $$;

create index if not exists students_student_status_idx
  on students (student_status) where student_status is not null;


-- ===========================================================================
-- 2. WHAT WAS MOVED
-- ===========================================================================
--
-- A column split that cannot be audited is a column split nobody can undo. One
-- row per student moved, with both values before and both after.

create table if not exists student_status_split (
  id             uuid primary key default gen_random_uuid(),
  student_id     uuid not null references students (id) on delete cascade,
  status_before  text,
  status_after   text,
  student_status_after text,
  /** How the row was decided, in words, for the ambiguous ones especially. */
  because        text not null,
  split_at       timestamptz not null default now()
);

create index if not exists student_status_split_student_idx
  on student_status_split (student_id);

alter table student_status_split enable row level security;

drop policy if exists student_status_split_read on student_status_split;
create policy student_status_split_read on student_status_split
  for select using (auth_role() in ('superadmin', 'admin', 'registrar'));

-- No insert, update or delete policy. The service role writes it and nobody
-- edits the record of what was moved.


-- ===========================================================================
-- 3. THE SPLIT
-- ===========================================================================
--
-- Only rows whose `status` is one of the four student words are touched. An
-- application sitting at `fee_paid` is not a student and is left exactly alone.
--
-- `withdrawn` IS THE ONLY HARD ONE, and it is decided by evidence rather than
-- by preference: a row with an enrolment date or a student number was a
-- student when they left, and a row with neither was an applicant. Rows that
-- carry neither piece of evidence stay applicants, because under-counting the
-- student body is the safe way to be wrong — the alternative is conferring
-- studenthood on somebody who never had it.

do $$
declare
  moved integer;
begin
  with decided as (
    select s.id,
           s.status as status_before,
           case
             when s.status in ('active', 'graduated', 'suspended') then 'enrolled'
             when s.status = 'withdrawn'
              and (s.enrolled_at is not null or s.student_number is not null) then 'enrolled'
             else s.status
           end as status_after,
           case
             when s.status in ('active', 'graduated', 'suspended') then s.status
             when s.status = 'withdrawn'
              and (s.enrolled_at is not null or s.student_number is not null) then 'withdrawn'
             else null
           end as student_status_after,
           case
             when s.status in ('active', 'graduated', 'suspended')
               then 'Was a student word in the admission column. The admission state can only '
                 || 'have been `enrolled`: you cannot graduate from, be suspended by or be '
                 || 'active at a university you were never enrolled at.'
             when s.status = 'withdrawn' and s.enrolled_at is not null
               then 'Withdrew after enrolment — `enrolled_at` is set — so this is a student '
                 || 'who left, not an applicant who declined.'
             when s.status = 'withdrawn' and s.student_number is not null
               then 'Withdrew holding a student number, so the University had already made '
                 || 'them a student.'
             when s.status = 'withdrawn'
               then 'Withdrew with no enrolment date and no student number, so they were an '
                 || 'applicant who stepped away. Left as an admission outcome.'
             else 'Not a student word. Untouched.'
           end as because
      from students s
     where s.status in ('active', 'graduated', 'suspended', 'withdrawn')
       -- Already split. A second run must move nothing.
       and s.student_status is null
       and not (s.status = 'withdrawn'
                and s.enrolled_at is null and s.student_number is null)
  ),
  logged as (
    insert into student_status_split
      (student_id, status_before, status_after, student_status_after, because)
    select id, status_before, status_after, student_status_after, because from decided
    returning 1
  )
  update students s
     set status = d.status_after,
         student_status = d.student_status_after
    from decided d
   where s.id = d.id;

  get diagnostics moved = row_count;
  raise notice '037: % student row(s) split into an admission state and a student status', moved;
end $$;

-- Anybody the Registrar has enrolled and who has no student status yet is
-- active. Written separately because it is a different statement: the rows
-- above were MIS-FILED, these were simply never asked the question.
update students
   set student_status = 'active'
 where status = 'enrolled' and student_status is null;


-- ===========================================================================
-- 4. `students.status` FINALLY GETS A VOCABULARY
-- ===========================================================================
--
-- NOT VALID, and that is the considered choice rather than the lazy one. A
-- validating constraint would refuse to be created at all if one row in years
-- of data carried a status nobody remembers writing, and the migration would
-- fail with a message about a single row instead of doing its job. NOT VALID
-- governs every write from this second onward, which is what stops the next
-- unnamed state, and 027's `admission_status_coverage` view already reports
-- anything historic that does not fit.
--
-- Run `alter table students validate constraint students_status_check;` once
-- the coverage view is clean, and it becomes a full constraint with no rewrite.

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'students_status_check') then
    alter table students add constraint students_status_check
      check (status in (
        'draft', 'applicant', 'under_review', 'documents_required', 'documents_verified',
        'fee_pending', 'fee_paid', 'registrar_approved', 'ready_for_academic_review',
        'approved', 'conditional', 'rejected', 'declined', 'deferred', 'returned',
        'admission_processing', 'admission_processing_failed', 'admission_issued',
        'enrolled', 'withdrawn'
      )) not valid;
  end if;
end $$;


-- ===========================================================================
-- 5. PERFORMING THE RULES
-- ===========================================================================

do $$
declare
  refused boolean;
  n integer;
  sid uuid;
begin
  -- ---- No student word is left in the admission column --------------------
  select count(*) into n from students
   where status in ('active', 'graduated', 'suspended');
  if n > 0 then
    raise exception '037 FAILED: % row(s) still carry a student status in `status`', n;
  end if;

  -- ---- A GRADUATE IS STILL RECORDED AS HAVING BEEN ENROLLED ---------------
  -- The thing the old column destroyed. Conferring a degree overwrote the
  -- enrolment, so the University's record that it had admitted and enrolled
  -- somebody was erased by the act of graduating them.
  select count(*) into n from students
   where student_status = 'graduated' and status <> 'enrolled';
  if n > 0 then
    raise exception '037 FAILED: % graduate(s) are not recorded as having been enrolled', n;
  end if;

  -- ---- An invented student status is refused ------------------------------
  select id into sid from students limit 1;
  if sid is not null then
    refused := false;
    begin
      update students set student_status = 'expelled' where id = sid;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '037 FAILED: `student_status` accepted a value nobody declared. The '
                      'vocabulary is not closed, which is how the old column went wrong.';
    end if;

    -- ---- And so is an invented admission state ---------------------------
    -- `students.status` has never had a constraint. This is the first time it
    -- refuses anything, and it is worth watching it do so.
    refused := false;
    begin
      update students set status = 'somebody_just_made_this_up' where id = sid;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '037 FAILED: `students.status` still accepts any text at all. The '
                      'constraint did not take.';
    end if;
  end if;

  raise notice '037 OK: the two vocabularies are in two columns and each refuses the other''s '
               'inventions';
end $$;


-- ===========================================================================
-- 6. VERIFY — READ THIS OUTPUT
-- ===========================================================================

-- What was moved, and why. Empty on a second run.
select status_before, status_after, student_status_after, count(*) as rows, min(because) as because
  from student_status_split
 group by 1, 2, 3
 order by 1;

-- The roll, as the University can now state it in one query rather than four
-- guessed values.
select coalesce(student_status, '— not a student —') as student_status,
       count(*) as people
  from students
 group by 1
 order by 2 desc;

-- WITHDRAWALS THAT COULD NOT BE DECIDED. Rows left as applicant withdrawals
-- because they carry neither an enrolment date nor a student number. If any of
-- these were students who left, set their student_status by hand — this
-- migration will not guess.
select id, first_name, last_name, matric_no, withdrawn_at
  from students
 where status = 'withdrawn' and student_status is null
 order by withdrawn_at desc nulls last;

-- Statuses the vocabulary does not know, from 027's view. The constraint is NOT
-- VALID until this is empty.
select * from admission_status_coverage where not in_vocabulary;
