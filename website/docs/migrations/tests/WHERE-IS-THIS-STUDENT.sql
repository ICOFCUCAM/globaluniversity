-- ===========================================================================
-- WHERE IS THIS STUDENT, AND WHY IS THEY NOT ON THE SCREEN I EXPECTED?
-- ===========================================================================
--
-- READS ONLY. CHANGES NOTHING. Safe to run on the live database at any time.
--
-- ---------------------------------------------------------------------------
-- WHY THIS FILE EXISTS
-- ---------------------------------------------------------------------------
--
-- The University asked why somebody who is enrolled was not on the Enrolment
-- screen when another enrolled student was. That question has come up before
-- in other shapes, and it almost always has the same cause.
--
-- A STUDENT ROW HAS TWO STATUS COLUMNS AND THEY ANSWER DIFFERENT QUESTIONS.
--
--   `status`         — where the APPLICATION got to. submitted, under review,
--                      approved, admission_issued, enrolled, declined,
--                      withdrawn. This is the admission pipeline.
--
--   `student_status` — what became of the PERSON once they were a student.
--                      active, graduated, suspended, withdrawn.
--
-- Migration 037 split them, because before it a single column held both and a
-- query asking "how many students do we have" was counting applications.
--
-- AND THE SCREENS READ DIFFERENT ONES, CORRECTLY.
--
--   Enrolment            reads `status`, and lists only
--                        'admission_issued' and 'enrolled'.
--   The dashboard count  reads `student_status is not null`.
--   Academic records     reads both and shows both.
--
-- So a person can be a real student by one column and invisible on Enrolment
-- by the other. That is not necessarily a fault — it usually means their
-- admission has not been ISSUED yet, and they are sitting on the Admissions
-- approval desk instead. This tells you which.
--
-- ---------------------------------------------------------------------------
-- HOW TO USE IT
-- ---------------------------------------------------------------------------
--
-- Replace the name below and run the whole file. It never writes anything.
-- ===========================================================================

\set who 'mabel'

-- ---------------------------------------------------------------------------
-- 1. EVERY ROW THAT COULD BE THEM, AND BOTH STATUSES
-- ---------------------------------------------------------------------------
--
-- The last column is the answer: it says, in words, which screen this person
-- is on and why they are not on the others.

select s.id,
       coalesce(s.first_name, '') || ' ' || coalesce(s.last_name, '') as name,
       s.email,
       s.matric_no,
       s.student_number,
       s.program,
       s.status          as admission_status,
       s.student_status,
       s.decided_at,
       s.enrolled_at,
       case
         -- ---- THE TWO THE ENROLMENT SCREEN SHOWS --------------------------
         when s.status = 'enrolled'
           then 'ON THE ENROLMENT SCREEN, under "Enrolled".'
         when s.status = 'admission_issued'
           then 'ON THE ENROLMENT SCREEN, under "Awaiting enrolment". Somebody has to record '
                || 'that they took up the place.'

         -- ---- THE ONE THAT LOOKS LIKE A FAULT AND IS ONE -------------------
         --
         -- The admission was being issued and the issuing did not finish. This
         -- is the state to look for first: the University decided, the letter
         -- was being produced, and something stopped. Nobody is waiting on a
         -- decision; they are waiting on a retry.
         when s.status = 'admission_processing_failed'
           then 'NOT on the Enrolment screen, AND THIS IS A FAULT. The admission was approved '
                || 'and the issuing FAILED part way through. Nobody is waiting on a decision '
                || '— it has been taken. Re-issue the admission from the Admissions approval '
                || 'desk and they will appear under "Awaiting enrolment".'
         when s.status = 'admission_processing'
           then 'NOT on the Enrolment screen YET. The admission is being issued right now. If '
                || 'it has said this for more than a few minutes, the issuing has stalled — '
                || 'treat it as admission_processing_failed and re-issue.'

         -- ---- DECIDED, NOT YET ISSUED -------------------------------------
         when s.status in ('approved', 'conditional')
           then 'NOT on the Enrolment screen, and correctly so. The application is approved '
                || 'but the admission has NOT BEEN ISSUED. It is on the Admissions approval '
                || 'desk, waiting for the Head of Academic Affairs to issue it. Issue it and '
                || 'they appear under "Awaiting enrolment".'

         -- ---- STILL MOVING THROUGH THE PIPELINE ---------------------------
         when s.status in ('draft', 'applicant', 'under_review')
           then 'NOT on the Enrolment screen. The application has not been decided yet — it '
                || 'is on the Admissions Office desk at "' || s.status || '".'
         when s.status in ('documents_required', 'documents_verified')
           then 'NOT on the Enrolment screen. It is at the documents stage ("' || s.status
                || '") on the Registrar desk.'
         when s.status in ('fee_pending', 'fee_paid')
           then 'NOT on the Enrolment screen. It is at the fee stage ("' || s.status
                || '") on the Finance desk.'
         when s.status in ('registrar_approved', 'ready_for_academic_review')
           then 'NOT on the Enrolment screen. The Registrar has cleared it and it is waiting '
                || 'for the academic decision on the Admissions approval desk.'
         when s.status = 'returned'
           then 'NOT on the Enrolment screen. The application was RETURNED to an earlier '
                || 'office for something to be corrected.'

         -- ---- ENDED --------------------------------------------------------
         when s.status in ('rejected', 'declined', 'deferred', 'withdrawn')
           then 'NOT on the Enrolment screen. The application ended: ' || s.status || '.'

         -- ---- THE COLUMNS DISAGREE -----------------------------------------
         --
         -- Only reachable for a row written before 037's CHECK, which is NOT
         -- VALID and therefore never tested the rows that already existed.
         when s.student_status is not null
           then 'THIS IS THE FAULT CASE. `student_status` says ' || s.student_status
                || ' — so the University treats this person as a student — but the admission '
                || 'column says ' || coalesce(s.status, 'nothing at all')
                || ', which is not a state the Enrolment screen lists. See section 3.'

         else 'NOT on the Enrolment screen, and not a student either: admission status is '
              || coalesce(s.status, 'empty') || ' and student status is empty.'
       end as where_they_are
  from students s
 where lower(coalesce(s.first_name, '') || ' ' || coalesce(s.last_name, '')) like '%' || :'who' || '%'
    or lower(coalesce(s.email, '')) like '%' || :'who' || '%'
    or lower(coalesce(s.matric_no, '')) like '%' || :'who' || '%'
    or lower(coalesce(s.student_number, '')) like '%' || :'who' || '%'
 order by s.created_at;


-- ---------------------------------------------------------------------------
-- 2. WHAT THE ENROLMENT SCREEN ITSELF SEES
-- ---------------------------------------------------------------------------
--
-- Exactly the filter the screen applies, so the two cannot disagree. If
-- somebody is in section 1 and not here, section 1's last column says why.

select s.status as admission_status,
       count(*) as how_many,
       string_agg(coalesce(s.first_name, '') || ' ' || coalesce(s.last_name, ''), ', '
                  order by s.decided_at) as who
  from students s
 where s.status in ('admission_issued', 'enrolled')
 group by s.status
 order by s.status;


-- ---------------------------------------------------------------------------
-- 3. ANYBODY THE TWO COLUMNS DISAGREE ABOUT
-- ---------------------------------------------------------------------------
--
-- THE ACTUAL FAULT, IF THERE IS ONE. A person the University treats as a
-- student — `student_status` is set — whose admission column says something
-- the Enrolment screen does not list. Every row here is somebody who exists
-- in the system and cannot be seen on the screen that is meant to show them.
--
-- An empty result means there is no such disagreement, and anybody missing
-- from the Enrolment screen is missing for the ordinary reason: their
-- admission has not been issued yet.

select s.id,
       coalesce(s.first_name, '') || ' ' || coalesce(s.last_name, '') as name,
       s.status          as admission_status,
       s.student_status,
       s.enrolled_at,
       s.student_number,
       'Treated as a student, but the admission column says ' || coalesce(s.status, 'nothing')
         || '. 037 split these two columns; this row looks like it was written by something '
         || 'that only set one of them.' as what_is_wrong
  from students s
 where s.student_status is not null
   and (s.status is null or s.status not in ('admission_issued', 'enrolled'))
 order by s.created_at;


-- ---------------------------------------------------------------------------
-- 4. AND WHAT 037 ALREADY CORRECTED, IF ANYTHING
-- ---------------------------------------------------------------------------
--
-- 037 logged every row it split and why. If a name appears here, the split
-- has already been applied to them and section 3 should be empty for them.

select l.student_id,
       coalesce(s.first_name, '') || ' ' || coalesce(s.last_name, '') as name,
       l.status_before,
       l.status_after,
       l.student_status_after,
       l.because
  from student_status_split l
  left join students s on s.id = l.student_id
 order by l.id;
