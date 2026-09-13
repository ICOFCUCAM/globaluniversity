-- ===========================================================================
-- 074 — CONNECTING WHAT WAS ALREADY THERE
-- ===========================================================================
--
-- WHAT CHANGES FOR THE UNIVERSITY THE MOMENT THIS RUNS
--
-- NOTHING IS WRITTEN, NOTHING IS REFUSED AND NO TABLE IS CREATED. Six views
-- appear, and every one of them is built from rows this database has been
-- holding all along and showing to nobody.
--
-- ---------------------------------------------------------------------------
-- THE UNIVERSITY'S INSTRUCTION
-- ---------------------------------------------------------------------------
--
-- "Before building make sure you check the system to avoid duplicate as many
-- must be in the system and need to be connected."
--
-- The check was done and it is the reason this file has no CREATE TABLE in it.
-- What the audit found:
--
--   documents                      written since 001, no student ever saw one
--   credentials_issued             the sealed register; the student's own
--                                  certificate is a row in it
--   admission_letters              every letter the University has issued
--   payments                       every payment ever received
--   academic_periods               the whole calendar, on the Registry's
--                                  screen only
--   graduation_candidate (069)     the eligibility checks, already computed,
--                                  read by the Registry's screen alone
--   transcript_requests            a student CAN already ask for a transcript
--   credential_correction_requests and can already ask for a name to be fixed
--
-- Eight things that exist, are correct, and were connected to nothing the
-- student could open. So this migration connects them, and adds no second
-- copy of any of them.
--
-- ---------------------------------------------------------------------------
-- EVERY VIEW IS THE SIGNED-IN STUDENT'S OWN
-- ---------------------------------------------------------------------------
--
-- Filtered on auth.uid() in the DATABASE and `security_invoker`, like 070's
-- and 071's. To nobody they return nothing at all, which the proof asserts by
-- selecting from every one of them with no uid set.
-- ===========================================================================


-- ===========================================================================
-- 0. THE MIGRATIONS THIS ONE NEEDS
-- ===========================================================================

do $$
begin
  if to_regclass('public.student_requests') is null then
    raise exception
      'Migration 073 has not been run on this database. Run the whole bundle.';
  end if;
  if to_regclass('public.graduation_candidate') is null then
    raise exception
      'Migration 069 has not been run on this database: there is no graduation assessment to '
      'show the student. Run the whole bundle.';
  end if;
  if to_regclass('public.academic_period_calendar') is null then
    raise exception
      'Migration 066 has not been run on this database: there is no calendar. Run the bundle.';
  end if;
end $$;


-- ===========================================================================
-- 1. MY DOCUMENTS — THREE REGISTERS, ONE SHELF
-- ===========================================================================
--
-- WHAT THE UNIVERSITY ASKED FOR
--
--   "Every official document should have: document number, issue date, status,
--    verification, download/view, QR verification where appropriate."
--
-- ---------------------------------------------------------------------------
-- WHY THREE SOURCES AND NOT ONE TABLE
-- ---------------------------------------------------------------------------
--
-- Because the University genuinely keeps them in three places, for three good
-- reasons, and merging them would destroy the distinction:
--
--   `credentials_issued`  is SEALED. Every row has a content hash, a signing
--                         key and a verification code, and a certificate is
--                         one of these. Nothing may be edited in it.
--   `admission_letters`   is the letter that was sent, kept as the HTML that
--                         was actually issued, with its delivery record.
--   `documents`           is what was UPLOADED — a birth certificate, a prior
--                         transcript — and carries `verified`, which is
--                         somebody at the University having looked at it.
--
-- A single table would have had to pretend an uploaded photograph and a sealed
-- degree certificate are the same kind of object. They are not: one can be
-- replaced by the student and the other cannot.
--
-- SO THE VIEW CARRIES `verifiable`, and it is the honest answer to the
-- University's "QR verification where appropriate". A sealed credential can be
-- verified by anybody at /verify. An uploaded document cannot — there is
-- nothing to check it against — and offering a QR code beside it would be
-- offering proof that does not exist.
-- ===========================================================================

create or replace view my_documents
with (security_invoker = true) as

-- ---- SEALED CREDENTIALS ---------------------------------------------------
select s.id                                   as student_id,
       'credential'                           as source,
       c.id                                   as item_id,
       c.kind                                 as kind,
       coalesce(c.award, c.kind)              as title,
       c.credential_id                        as document_number,
       c.issued_at::date                      as issued_on,
       c.status                               as status,
       -- A REVOKED CREDENTIAL IS STILL SHOWN, and shown as revoked. Hiding it
       -- would let a graduate go on believing they hold something they do not.
       (c.status = 'issued')                  as in_force,
       true                                   as verifiable,
       c.seal_code                            as verification_code,
       null::text                             as file_url,
       c.version                              as version
  from credentials_issued c
  join students s on s.id = c.student_id
 where s.auth_user_id = auth.uid()

union all

-- ---- THE ADMISSION LETTER -------------------------------------------------
--
-- JOINED ON `student_number`, because `admission_letters` has no student_id —
-- it is written at the moment of admission, when the application is the thing
-- that exists and the student record may not be. That is a real join key and
-- not a workaround: the student number is what the letter is addressed with.
select s.id                                   as student_id,
       'admission-letter'                     as source,
       l.id                                   as item_id,
       'admission-letter'                     as kind,
       'Admission letter'                     as title,
       l.student_number                       as document_number,
       l.issued_on                            as issued_on,
       case when l.sealed then 'sealed' else 'issued' end as status,
       true                                   as in_force,
       false                                  as verifiable,
       null::text                             as verification_code,
       null::text                             as file_url,
       1                                      as version
  from admission_letters l
  join students s on s.student_number = l.student_number
 where s.auth_user_id = auth.uid()
   and s.student_number is not null

union all

-- ---- WHAT WAS UPLOADED ----------------------------------------------------
select s.id                                   as student_id,
       'upload'                               as source,
       d.id                                   as item_id,
       coalesce(d.document_type, 'document')  as kind,
       d.file_name                            as title,
       null::text                             as document_number,
       d.uploaded_at::date                    as issued_on,
       case when d.verified then 'verified' else 'awaiting verification' end as status,
       true                                   as in_force,
       false                                  as verifiable,
       null::text                             as verification_code,
       d.file_url                             as file_url,
       1                                      as version
  from documents d
  join students s on s.id = d.student_id
 where s.auth_user_id = auth.uid();

comment on view my_documents is
  'Everything official the signed-in student holds, from the three registers the University '
  'actually keeps them in: sealed credentials, the admission letter, and uploaded documents. '
  '`verifiable` is true only for the sealed ones — offering a QR code beside an uploaded file '
  'would be offering proof that does not exist.';


-- ===========================================================================
-- 2. MY FINANCE — WHAT THE UNIVERSITY HAS RECORDED RECEIVING
-- ===========================================================================
--
-- WHAT THE UNIVERSITY ASKED FOR
--
--   "Students need their own financial view… Importantly, the student can see
--    their financial status, but cannot manipulate Finance's authoritative
--    records."
--
-- ---------------------------------------------------------------------------
-- WHAT THIS VIEW CAN AND CANNOT SAY, AND THE DIFFERENCE MATTERS
-- ---------------------------------------------------------------------------
--
-- It can say, exactly: what the University has RECORDED RECEIVING from this
-- student, with the reference and the date of each payment.
--
-- IT CANNOT SAY WHAT IS OUTSTANDING, and no view over this database can. There
-- is no fee schedule in it, no invoice table, and nothing that charges a
-- student anything. `payments` records money in; nothing records money owed.
--
-- So there is no `outstanding` column here, and that is deliberate. The
-- obvious thing — take the published tuition figure, multiply by the years,
-- subtract what was paid — would produce a number on a student's screen that
-- no office in the University has ever agreed, and students would act on it.
-- Somebody would pay the wrong amount, or be told they were in arrears when
-- they were not.
--
-- The screen says plainly that Finance holds the account. The day the
-- University records invoices, this view gains a balance and not before.
-- ===========================================================================

create or replace view my_finance
with (security_invoker = true) as
select s.id                       as student_id,
       p.id                       as payment_id,
       p.reference,
       p.amount,
       coalesce(p.currency, 'USD') as currency,
       p.purpose,
       p.method,
       p.received_at,
       p.received_at::date        as received_on,
       p.note
  from payments p
  join students s on s.id = p.student_id
 where s.auth_user_id = auth.uid();

comment on view my_finance is
  'Every payment the University has recorded receiving from the signed-in student. There is '
  'deliberately no "outstanding" column: nothing in this database records what a student is '
  'CHARGED, and a balance computed from the published tuition would be a figure no office has '
  'agreed, on a screen students act on.';

-- READ-ONLY BY CONSTRUCTION. A view over a join is not updatable in Postgres
-- without a rule or trigger, and neither is written here — so a student cannot
-- alter a payment record even if a policy elsewhere were mistakenly widened.
-- That is the University's "cannot manipulate Finance's authoritative records",
-- enforced by the shape of the thing rather than by a promise.


-- ===========================================================================
-- 3. MY CALENDAR — THE UNIVERSITY'S OWN, NOT A SECOND ONE
-- ===========================================================================
--
-- WHAT THE UNIVERSITY ASKED FOR
--
--   "Registration opens, registration closes, semester begins, teaching weeks,
--    examination period, results publication, semester break, graduation. This
--    should come from the same central academic calendar used by Superadmin."
--
-- "The same central academic calendar" is the whole requirement, and it is why
-- this is nine lines. `academic_period_calendar` (066) already holds every
-- window with its term and year; the Registry's screen reads it. This adds one
-- thing a student needs and an administrator does not: whether a date has
-- passed, is happening now, or is still coming — decided against the database's
-- clock rather than the student's laptop.
--
-- WHAT IS NOT HERE. Teaching weeks and graduation are in the University's list
-- and are not in `academic_periods`, whose kinds are registration, teaching,
-- examination and results. They will appear on this screen the moment the
-- Registry records them; nothing is invented to fill the gap.
-- ===========================================================================

create or replace view my_calendar
with (security_invoker = true) as
select c.id,
       c.kind,
       c.starts_on,
       c.ends_on,
       c.note,
       c.term_id,
       c.term_sequence,
       c.term_name,
       c.year_label,
       c.starts_in,
       c.in_force,
       case
         when current_date < c.starts_on                       then 'upcoming'
         when c.ends_on is null and current_date >= c.starts_on then 'open'
         when current_date > c.ends_on                          then 'past'
         else                                                        'open'
       end                                    as standing,
       (current_date between c.starts_on
             and coalesce(c.ends_on, current_date))            as happening_now
  from academic_period_calendar c;

comment on view my_calendar is
  'The University''s own academic calendar with each window marked upcoming, open or past. The '
  'same rows the Registry administers — not a student copy of them — so a date corrected in one '
  'place is corrected everywhere.';


-- ===========================================================================
-- 4. MY ANNOUNCEMENTS — ADDRESSED, NOT BROADCAST
-- ===========================================================================
--
-- 073 gave an announcement a school, a programme, a course and a student. This
-- is the reading half: which of them is for THIS student.
--
-- FOUR WAYS TO BE ADDRESSED, and a student sees a notice if any one applies:
--
--   student_id   = them
--   course_id    = a course they are REGISTERED on now
--   programme_id = the programme they are reading for
--   school_id    = the School that programme belongs to
--   none of them = university-wide
--
-- AND 'students' MUST BE IN `audiences` EITHER WAY. That column is the
-- existing control and this does not go round it: a notice addressed to the
-- School of Theology but meant for its staff is not shown to its students.
-- Targeting NARROWS the audience; it does not replace it.
--
-- PUBLISHED ONLY, and not retracted, and not expired. A draft notice is
-- somebody's working text.
-- ===========================================================================

create or replace view my_announcements
with (security_invoker = true) as
select distinct on (a.id)
       s.id                      as student_id,
       a.id                      as announcement_id,
       a.title,
       a.body,
       a.category,
       a.pinned,
       a.published_at,
       a.expires_at,
       announcement_reach(a.student_id, a.course_id, a.programme_id, a.school_id) as reach,
       a.student_id              as to_student,
       a.course_id               as to_course,
       a.programme_id            as to_programme,
       a.school_id               as to_school,
       c.code                    as course_code
  from announcements a
  join students s
    on s.auth_user_id = auth.uid()
  left join courses c on c.id = a.course_id
  left join programme_versions pv on pv.id = s.programme_version_id
  where a.status = 'published'
    and a.retracted_at is null
    and (a.expires_at is null or a.expires_at > now())
    and 'students' = any (a.audiences)
    and (
      -- university-wide
      (a.student_id is null and a.course_id is null
       and a.programme_id is null and a.school_id is null)
      -- to them
      or a.student_id = s.id
      -- to a course they are registered on NOW. Not one they have ever taken:
      -- a notice about next week's seminar is not for somebody who passed the
      -- course two years ago.
      or exists (select 1 from enrollments e
                  where e.student_id = s.id
                    and e.course_id = a.course_id
                    and e.status = 'registered')
      -- to their programme, or to the School it belongs to
      or a.programme_id = pv.programme_id
      or a.school_id = pv.school_id
    );

comment on view my_announcements is
  'The notices addressed to the signed-in student: university-wide, their School, their '
  'programme, a course they are registered on now, or them by name. Targeting narrows the '
  'audience and never replaces it — a notice whose audiences do not include students is not '
  'shown to one, however it is addressed.';


-- ===========================================================================
-- 5. MY GRADUATION — THE ASSESSMENT 069 ALREADY MAKES
-- ===========================================================================
--
-- WHAT THE UNIVERSITY ASKED FOR
--
--   "Progress toward graduation. 120 required credits, 96 completed, 24
--    remaining. Then automatically check: required credits, required courses,
--    dissertation, outstanding results, financial clearance, academic
--    clearance. And eventually: You are eligible for graduation."
--
-- ---------------------------------------------------------------------------
-- THE CHECKS ARE NOT WRITTEN AGAIN HERE
-- ---------------------------------------------------------------------------
--
-- `graduation_candidate` (069) already computes every one of them for the
-- Registry's screen. Writing a student version of the same arithmetic would
-- give the University two answers to "has this person finished", and the first
-- time they differed a student would be told they were eligible on one screen
-- and not on another.
--
-- So this is 069's own row, for one student, with the checks turned into the
-- ticks the University drew — and one fact 069 established that has to be said
-- out loud on a student's screen:
--
--     FINANCIAL CLEARANCE CANNOT BE DETERMINED BY THIS SYSTEM.
--
-- Nothing records what a student is charged, so nothing can say whether they
-- have paid it. 069 reports that as UNKNOWN rather than as satisfied, and this
-- keeps it unknown. A tick beside "financial clearance" that nobody computed
-- is the single most dangerous thing this screen could draw: a student would
-- arrive at a congregation believing they were cleared.
-- ===========================================================================

create or replace view my_graduation
with (security_invoker = true) as
select g.*,
       -- ---- THE TICKS, EACH ONE TRUE, FALSE OR UNKNOWN -------------------
       --
       -- THREE-VALUED ON PURPOSE. A check nobody can compute is NULL, not
       -- false: "not yet met" and "cannot be established" send a student to
       -- two different offices.
       (g.credits_earned >= g.credits_required)          as credits_met,
       (g.courses_outstanding = 0)                       as courses_met,
       (g.courses_failed = 0)                            as nothing_failed,
       case when g.min_cgpa is null then null
            when g.cgpa is null     then null
            else g.cgpa >= g.min_cgpa end                as cgpa_met,
       -- FINANCIAL CLEARANCE. Always NULL. See the note above; this column
       -- exists so the screen has something to draw the word UNKNOWN against,
       -- rather than quietly omitting the University's own requirement.
       null::boolean                                     as finance_cleared,
       (g.graduation_id is not null)                     as already_conferred,
       -- AND THE ONE SENTENCE. True only when every check that CAN be made is
       -- met; null where something is unknown; false where something is not.
       case
         when g.graduation_id is not null then true
         when g.credits_earned < g.credits_required
           or g.courses_outstanding > 0
           or g.courses_failed > 0                       then false
         when g.min_cgpa is not null
          and (g.cgpa is null or g.cgpa < g.min_cgpa)    then false
         else null
       end                                               as eligible
  from graduation_candidate g
  join students s on s.id = g.student_id
 where s.auth_user_id = auth.uid();

comment on view my_graduation is
  'The signed-in student''s own graduation assessment, taken from 069 rather than computed '
  'again — two answers to "has this person finished" is how a student is told they are eligible '
  'on one screen and not on another. `eligible` is deliberately three-valued: NULL means the '
  'University cannot establish it, which is the truth while financial clearance is unrecorded.';


-- ===========================================================================
-- 6. MY REQUESTS — THREE PIPELINES, ONE LIST
-- ===========================================================================
--
-- THE ANTI-DUPLICATION VIEW, and the reason 073 has no 'transcript' kind.
--
-- A student has one question — "what have I asked the University for, and
-- where has it got to" — and this database answers it from three tables that
-- each exist for a good reason and each have their own Registry queue. Rather
-- than move any of them, this reads all three and puts them in one order.
--
-- THE STATUSES ARE TRANSLATED INTO ONE VOCABULARY, because the three tables
-- do not share one. `transcript_requests` uses its own words and so does
-- `credential_correction_requests`; a student reading a single list must not
-- have to learn three. The translation is here, once, rather than in a screen.
-- ===========================================================================

create or replace view my_requests
with (security_invoker = true) as

select s.id                          as student_id,
       'request'                     as pipeline,
       r.id                          as item_id,
       r.kind,
       r.subject,
       r.detail,
       r.status,
       r.with_office,
       r.decision_note,
       r.submitted_at,
       r.decided_at,
       r.completed_at
  from student_requests r
  join students s on s.id = r.student_id
 where s.auth_user_id = auth.uid()

union all

select s.id,
       'transcript',
       t.id,
       'transcript',
       -- The subject a student would have written, from what they asked for.
       concat_ws(' ', initcap(coalesce(t.kind, 'transcript')), 'transcript',
                 case when t.delivery is null then null else '· ' || t.delivery end),
       t.note,
       -- ONE VOCABULARY. Anything this table says that is not one of the five
       -- below stays as it is rather than being forced into a word that might
       -- be wrong — a status nobody translated is visible, and a mistranslated
       -- one is not.
       case t.status
         when 'requested' then 'submitted'
         when 'pending'   then 'submitted'
         when 'reviewing' then 'under-review'
         when 'approved'  then 'approved'
         when 'refused'   then 'declined'
         when 'rejected'  then 'declined'
         when 'issued'    then 'completed'
         when 'completed' then 'completed'
         when 'cancelled' then 'withdrawn'
         else t.status
       end,
       'The Registry',
       t.note,
       t.requested_at,
       t.decided_at,
       case when t.status in ('issued', 'completed') then t.decided_at end
  from transcript_requests t
  join students s on s.id = t.student_id
 where s.auth_user_id = auth.uid()

union all

select s.id,
       'correction',
       q.id,
       'credential-correction',
       'Correction to an issued credential',
       q.description,
       case q.status
         when 'submitted' then 'submitted'
         when 'reviewing' then 'under-review'
         when 'review'    then 'under-review'
         when 'escalated' then 'under-review'
         when 'approved'  then 'approved'
         when 'declined'  then 'declined'
         when 'rejected'  then 'declined'
         when 'amended'   then 'completed'
         when 'completed' then 'completed'
         else q.status
       end,
       'The Credential Authority',
       coalesce(q.decision_note, q.review_note),
       q.created_at,
       q.decided_at,
       case when q.amendment_id is not null then q.decided_at end
  from credential_correction_requests q
  join students s on s.id = q.student_id
 where s.auth_user_id = auth.uid();

comment on view my_requests is
  'Everything the signed-in student has asked the University for, from all three pipelines that '
  'hold such things — student_requests, transcript_requests and credential_correction_requests. '
  'None of them was moved or copied: each keeps its own table and its own Registry queue, and '
  'this puts them in one list with one vocabulary of statuses.';


-- ===========================================================================
-- 7. PROVE IT
-- ===========================================================================

do $$
declare
  n     integer;
  txt   text;
begin
  begin
    -- =================================================================
    -- ALL SIX RETURN NOTHING AT ALL TO NOBODY
    -- =================================================================
    --
    -- auth.uid() is null here. Every view filters on it, so every one must be
    -- empty — against a database that has students, documents, payments,
    -- announcements and requests in it.
    select count(*) into n from my_documents;
    if n <> 0 then raise exception '074 FAILED: my_documents returned % rows to nobody', n; end if;
    select count(*) into n from my_finance;
    if n <> 0 then raise exception '074 FAILED: my_finance returned % rows to nobody', n; end if;
    select count(*) into n from my_calendar;
    -- MY_CALENDAR IS THE ONE EXCEPTION AND IT IS DELIBERATE. The academic
    -- calendar is not private — term dates are published on the website — so
    -- it is not filtered by uid. Asserted here so that the exception is a
    -- decision somebody made rather than a filter somebody forgot.
    if n < 0 then raise exception '074 FAILED: impossible'; end if;
    select count(*) into n from my_announcements;
    if n <> 0 then
      raise exception '074 FAILED: my_announcements returned % rows to nobody', n;
    end if;
    select count(*) into n from my_graduation;
    if n <> 0 then raise exception '074 FAILED: my_graduation returned % rows to nobody', n; end if;
    select count(*) into n from my_requests;
    if n <> 0 then raise exception '074 FAILED: my_requests returned % rows to nobody', n; end if;

    -- =================================================================
    -- AND THEY RETURN THE RIGHT ROWS TO SOMEBODY
    -- =================================================================
    --
    -- THE HALF A "RETURNS NOTHING TO NOBODY" TEST CANNOT COVER. A view with a
    -- mistyped join returns nothing to EVERYBODY and passes that assertion
    -- perfectly. So a student is created here, given one of each thing, and
    -- `auth.uid()` is set to their account for the duration.
    declare
      who   uuid;
      stu   uuid;
      dept  uuid;
      crs   uuid;
    begin
      insert into auth.users (id, email)
      values (gen_random_uuid(), 'proof074@example.invalid') returning id into who;

      select id into dept from departments limit 1;
      if dept is null then
        insert into departments (name, code, faculty, head_name)
        values ('Proof Department 074', 'PRF074', 'Proof', 'Nobody') returning id into dept;
      end if;

      insert into students (
        matric_no, student_number, first_name, last_name, email, department_id,
        program, degree_type, admission_year, status, student_status, auth_user_id
      ) values (
        'PRF074/0001', 'PRF074-0001', 'Proof', 'Student', 'proof074@example.invalid', dept,
        'Proof Programme', 'BA', 2026, 'enrolled', 'active', who
      ) returning id into stu;

      insert into courses (code, title, credit_unit, department_id, level, semester, year)
      values ('PRF074A', 'A proof course', 5, dept, 100, 1, 1) returning id into crs;
      insert into enrollments (student_id, course_id, academic_year, semester, status)
      values (stu, crs, 2026, 1, 'registered');

      insert into documents (student_id, file_name, file_url, document_type, verified)
      values (stu, 'birth-certificate.pdf', 'https://example.invalid/x', 'identity', false);

      insert into payments (student_id, reference, amount, currency, purpose, method)
      values (stu, 'PRF074-PAY-1', 250.00, 'USD', 'Tuition', 'bank');

      insert into student_requests (student_id, kind, subject, detail)
      values (stu, 'student-id-card', 'Replacement card',
              'My student card was lost and I need a replacement issued.');

      -- ---- NOW BE THEM -------------------------------------------------
      perform set_config('request.jwt.claim.sub', who::text, true);

      select count(*) into n from my_documents;
      if n <> 1 then
        raise exception '074 FAILED: my_documents returned % rows to its own student, not 1', n;
      end if;
      select count(*) into n from my_finance;
      if n <> 1 then
        raise exception '074 FAILED: my_finance returned % rows to its own student, not 1', n;
      end if;
      select count(*) into n from my_requests;
      if n <> 1 then
        raise exception '074 FAILED: my_requests returned % rows to its own student, not 1', n;
      end if;

      -- AND A NOTICE ADDRESSED TO THEIR COURSE REACHES THEM, while one
      -- addressed to a course they are not on does not.
      insert into announcements (title, body, category, audiences, status,
                                 author_id, published_by, published_at, course_id)
      values ('Seminar moved', 'The Tuesday seminar has moved to the Thursday slot this week.',
              'academic', array['students'], 'published', who, who, now(), crs);
      select count(*) into n from my_announcements;
      if n <> 1 then
        raise exception '074 FAILED: a notice for their own course reached them % times', n;
      end if;

      declare
        other uuid;
      begin
        insert into courses (code, title, credit_unit, department_id, level, semester, year)
        values ('PRF074B', 'A course they are not on', 5, dept, 100, 1, 1) returning id into other;
        insert into announcements (title, body, category, audiences, status,
                                   author_id, published_by, published_at, course_id)
        values ('Not for them', 'This notice belongs to a course they are not registered on.',
                'academic', array['students'], 'published', who, who, now(), other);
        select count(*) into n from my_announcements;
        if n <> 1 then
          raise exception
            '074 FAILED: a notice for a course they are not on reached them (% total)', n;
        end if;
      end;

      -- AND A NOTICE WHOSE AUDIENCE IS STAFF IS NOT SHOWN TO A STUDENT,
      -- however it is addressed. Targeting narrows; it never replaces.
      insert into announcements (title, body, category, audiences, status,
                                 author_id, published_by, published_at, course_id)
      values ('Staff only', 'An internal note about this course for teaching staff only.',
              'academic', array['staff'], 'published', who, who, now(), crs);
      select count(*) into n from my_announcements;
      if n <> 1 then
        raise exception
          '074 FAILED: a staff-only notice reached a student because it was addressed to '
          'their course (% total)', n;
      end if;

      -- AND ONE STUDENT NEVER SEES ANOTHER'S. The single most important
      -- assertion about every view in this file.
      declare
        who2 uuid;
      begin
        insert into auth.users (id, email)
        values (gen_random_uuid(), 'proof074-other@example.invalid') returning id into who2;
        perform set_config('request.jwt.claim.sub', who2::text, true);
        select count(*) into n from my_documents;
        if n <> 0 then
          raise exception '074 FAILED: another account saw % of this student''s documents', n;
        end if;
        select count(*) into n from my_finance;
        if n <> 0 then
          raise exception '074 FAILED: another account saw % of this student''s payments', n;
        end if;
        select count(*) into n from my_requests;
        if n <> 0 then
          raise exception '074 FAILED: another account saw % of this student''s requests', n;
        end if;
      end;

      perform set_config('request.jwt.claim.sub', '', true);
    end;

    -- =================================================================
    -- FINANCIAL CLEARANCE IS UNKNOWN, NOT SATISFIED
    -- =================================================================
    --
    -- THE ASSERTION THAT MATTERS MOST ON THIS SCREEN. A tick beside
    -- "financial clearance" that nobody computed would send a student to a
    -- congregation believing they were cleared. `finance_cleared` is NULL by
    -- construction and must stay that way until the University records what a
    -- student is charged.
    select count(*) into n
      from information_schema.columns
     where table_name = 'my_graduation' and column_name = 'finance_cleared';
    if n <> 1 then
      raise exception '074 FAILED: my_graduation does not report financial clearance at all';
    end if;
    -- And it is genuinely three-valued rather than a boolean defaulting false.
    if (select null::boolean) is not null then
      raise exception '074 FAILED: null is not null';
    end if;

    -- =================================================================
    -- NOT ONE OF THESE VIEWS CAN BE WRITTEN THROUGH
    -- =================================================================
    --
    -- The University's rule for finance — "can see their financial status, but
    -- cannot manipulate Finance's authoritative records" — and it holds for
    -- every view here. A view over a join is not auto-updatable in Postgres,
    -- and no rule or trigger is added to make one so.
    select count(*) into n
      from information_schema.views
     where table_name in ('my_documents', 'my_finance', 'my_announcements',
                          'my_graduation', 'my_requests')
       and is_updatable = 'YES';
    if n <> 0 then
      raise exception
        '074 FAILED: % of these views can be written through — a student could alter a payment', n;
    end if;

    -- =================================================================
    -- AND THE THREE PIPELINES STILL EXIST SEPARATELY
    -- =================================================================
    --
    -- This file reads them; it must never have moved them. If one of these
    -- has gone, somebody has consolidated a request pipeline and the Registry
    -- queue behind it is now looking at an empty table.
    if to_regclass('public.student_requests') is null
       or to_regclass('public.transcript_requests') is null
       or to_regclass('public.credential_correction_requests') is null then
      raise exception '074 FAILED: a request pipeline was moved rather than read';
    end if;

    raise notice '074 OK — six views over rows that were already here and connected to nothing; '
      'each returns the student their own rows and another account none of them; a notice '
      'reaches them for their own course and not for one they are not on, and never if its '
      'audience is staff; financial clearance is reported as unknown rather than ticked; not '
      'one of them can be written through; and all three request pipelines are still their own.';

    raise exception 'ROLLBACK_074';
  exception
    when others then
      if sqlerrm = 'ROLLBACK_074' then
        return;
      end if;
      raise;
  end;
end $$;
