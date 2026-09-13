-- ===========================================================================
-- 069 — THE END OF THE CHAIN
-- ===========================================================================
--
-- WHAT CHANGES FOR THE UNIVERSITY THE MOMENT THIS RUNS
--
-- NOTHING IS CONFERRED AND NOTHING IS REFUSED. A view appears that gathers, for
-- every student, what a graduation decision actually needs — the award they are
-- reading for, the credits they have earned, their cumulative GPA, any
-- outstanding condition of admission, and whether a degree has already been
-- conferred on them.
--
-- And one column is added to `graduation_records`, for the case the table could
-- not previously record: a Senate conferring a degree on a candidate who did
-- not meet every requirement, WITH ITS REASON.
--
-- ---------------------------------------------------------------------------
-- THE TABLE HAS EXISTED SINCE 019 AND NOTHING HAS EVER TOUCHED IT
-- ---------------------------------------------------------------------------
--
-- `graduation_records` was created in migration 019, with a good design: the
-- Senate's resolution date is NOT NULL, a degree cannot be conferred before the
-- Senate resolved to confer it, and one award is conferred on one student once.
--
-- No screen and no route has ever read or written a row into it. It is the same
-- fault `reachability.test.mjs` was written to catch — a thing that exists, is
-- correct, and is connected to nothing — and it escaped that test only because
-- the test hunts tables that are READ and never written. This one was neither.
--
-- So this migration adds no table. The end of the chain was already modelled;
-- it just had no door.
--
-- ---------------------------------------------------------------------------
-- WHAT THIS SYSTEM CANNOT ESTABLISH, AND SAYS SO
-- ---------------------------------------------------------------------------
--
-- `src/lib/graduation.ts` checks four things: credits, cumulative GPA,
-- outstanding admission conditions, and fees. Three are answerable from rows.
--
-- THE FOURTH IS NOT. The University keeps no per-student fee schedule in this
-- system — `payments` records what was received, and nothing records what was
-- owed — so a balance cannot be computed. `assessGraduation` is already
-- careful about this: it reports the fee check as UNKNOWN rather than as zero,
-- because "we did not look" and "nothing is owed" are different answers and
-- only one of them should let a degree through.
--
-- The consequence is worth stating plainly rather than discovering: NO
-- CANDIDATE EVER FULLY QUALIFIES BY COMPUTATION. Every verdict is
-- indeterminate on fees. That is not a bug to be worked around by pretending
-- the balance is zero — it is the system telling the truth about what it
-- knows, and the Senate confers on a fee position confirmed with the Finance
-- Office, not with this screen.
--
-- ---------------------------------------------------------------------------
-- AND A CONFERRAL IS A RECORD OF AN ACT, NOT THE ACT
-- ---------------------------------------------------------------------------
--
-- `graduation.ts` says it in its own header: "Whether the Senate has resolved
-- to confer… is a meeting, not a computation, and no query stands in for it —
-- this establishes that a candidate QUALIFIES, and a human still confers."
--
-- 019 built that in: `senate_approved_on` is NOT NULL, so a conferral cannot
-- be recorded without naming the day the Senate resolved. What follows adds
-- the missing half of the same idea — where the Senate confers DESPITE an
-- unmet requirement, the reason is recorded on the row and stays there.
-- ===========================================================================


-- ===========================================================================
-- 0. THE MIGRATIONS THIS ONE NEEDS
-- ===========================================================================

do $$
begin
  if to_regclass('public.graduation_records') is null then
    raise exception
      'Migration 019 has not been run on this database: there is no graduation record to write '
      'into. Run 019_academic_record.sql first, or run the whole bundle.';
  end if;
  if to_regclass('public.student_academic_record') is null then
    raise exception
      'Migration 067 has not been run on this database: there is no academic record to assess a '
      'candidate from. Run 067_one_student_one_record.sql first, or run the whole bundle.';
  end if;
end $$;


-- ===========================================================================
-- 1. CONFERRED DESPITE SOMETHING
-- ===========================================================================
--
-- NULL IS THE NORMAL CASE, and it means the candidate met every requirement
-- the system could check.
--
-- A VALUE MEANS THE SENATE WENT AHEAD ANYWAY, and says why. That happens — an
-- aegrotat award, a case referred and resolved, a requirement waived on
-- evidence this system never held — and a University whose system cannot
-- record it is a University that records it on paper, where no audit will find
-- it and no later question can be answered from it.
--
-- IT IS NOT A FLAG. A boolean would say that something was overridden and not
-- what; the reason is the whole value of the column, and it stays on the row
-- for as long as the degree stands.

alter table graduation_records
  add column if not exists conferred_despite text;

comment on column graduation_records.conferred_despite is
  'Where the Senate conferred despite an unmet requirement, the reason — in words, not a flag. '
  'Null is the normal case and means every requirement the system can check was met. A '
  'University whose system cannot record an exception records it on paper, where no audit finds '
  'it.';


-- ===========================================================================
-- 2. EVERY CANDIDATE, WITH WHAT A DECISION NEEDS
-- ===========================================================================
--
-- One row per student who is reading for an award, carrying the four inputs
-- `assessGraduation` takes. Gathered here rather than in five reads per
-- candidate, so that a cohort of two hundred is one query.
--
-- THE ASSESSMENT ITSELF IS NOT DONE HERE. `src/lib/graduation.ts` holds it,
-- tested, and it is the same function the Certificate Generator already calls.
-- A second copy in SQL would mean a candidate's eligibility depending on which
-- screen asked — which is the exact fault `prerequisites.ts` exists to prevent
-- one level down.

create or replace view graduation_candidate
with (security_invoker = true) as
select r.student_id,
       r.matric_no,
       r.student_number,
       r.full_name,
       r.status,
       r.student_status,
       r.programme_code,
       r.programme_name,
       r.credits_required,
       r.credits_earned,
       r.credits_against_award,
       r.courses_outstanding,
       r.courses_failed,
       r.cgpa,
       s.award_id,
       a.code                     as award_code,
       a.title                    as award_title,
       a.kind                     as award_kind,
       a.credits_required         as award_credits_required,
       a.min_cgpa,
       a.cgpa_confirmed,
       -- THE ADMISSION CONDITIONS, AS THE COLUMN HOLDS THEM. Text, parsed by
       -- the caller. Not parsed here: `assessGraduation` already treats
       -- unparseable conditions as ONE OUTSTANDING ITEM rather than as none,
       -- and a view that silently returned an empty array on bad JSON would
       -- wave through the case that most needs looking at.
       s.admission_conditions,
       -- ---- AND WHETHER IT IS ALREADY DONE --------------------------------
       g.id                       as graduation_id,
       g.senate_approved_on,
       g.conferred_on,
       g.convocation_on,
       g.classification,
       g.graduation_number,
       g.certificate_credential_id,
       g.conferred_despite
  from student_academic_record r
  join students s on s.id = r.student_id
  left join awards a on a.id = s.award_id
  -- ONE CONFERRAL OF ONE AWARD TO ONE STUDENT — 019's unique constraint, so
  -- this join cannot multiply rows.
  left join graduation_records g
    on g.student_id = s.id and g.award_id is not distinct from s.award_id;

comment on view graduation_candidate is
  'Every student reading for an award, with the four inputs a graduation decision needs and '
  'whether a degree has already been conferred. The assessment itself lives in '
  'src/lib/graduation.ts and is not restated here — a second copy would mean eligibility '
  'depending on which screen asked.';


-- ===========================================================================
-- 3. AND THE COHORT, TOTALLED
-- ===========================================================================
--
-- What a Registrar preparing a congregation needs at a glance: how many have
-- been conferred, on what dates, and how many are still candidates.

create or replace view graduation_cohort
with (security_invoker = true) as
select coalesce(g.conferred_on, date '1900-01-01')      as conferred_on,
       count(*)                                          as conferred,
       count(*) filter (where g.conferred_despite is not null) as conferred_despite,
       count(distinct g.award_id)                        as awards,
       min(g.senate_approved_on)                         as senate_approved_on,
       max(g.convocation_on)                             as convocation_on
  from graduation_records g
 group by g.conferred_on;

comment on view graduation_cohort is
  'Conferrals grouped by the day they were conferred — a congregation, as the record sees it. '
  '`conferred_despite` counts the ones where the Senate went ahead over an unmet requirement.';


-- ===========================================================================
-- 4. WHO CAN WRITE ONE
-- ===========================================================================
--
-- 019 gave the table a READ policy and no write policy at all, which is why
-- nothing could ever write to it through the client. That stays: every
-- conferral goes through /api/academic/graduation, which re-runs the
-- assessment server-side before it writes.
--
-- The read policy 019 set already includes the student's own row, so a
-- graduate can see their own conferral. Nothing here widens it.


-- ===========================================================================
-- 5. PROVE IT
-- ===========================================================================

do $$
declare
  dept     uuid;
  v_id     uuid;
  prog_id  uuid;
  award    uuid;
  stu      uuid;
  n        integer;
  refused  boolean;
  g_id     uuid;
begin
  begin
    select id into dept from departments limit 1;
    if dept is null then
      insert into departments (name, code, faculty, head_name)
        values ('Proof 069', 'P069', 'Proof', 'Nobody') returning id into dept;
    end if;

    insert into programmes (code, award_level, status)
      values ('proof-069-programme', 'Diploma', 'draft') returning id into prog_id;
    insert into programme_versions
      (programme_id, version_label, name, duration_years, semesters_per_year,
       total_credits, status, effective_from)
      values (prog_id, 'v-proof', 'A Proof Programme', 1, 2, 24, 'draft', date '2026-08-15')
      returning id into v_id;

    insert into awards (code, title, kind, credits_required, min_cgpa, cgpa_confirmed)
      values ('P069', 'Proof Award', 'diploma', 24, 2.00, true)
      returning id into award;

    insert into students (matric_no, first_name, last_name, email, department_id,
                          program, degree_type, admission_year, status,
                          programme_version_id, award_id)
      values ('PROOF/069/1', 'A', 'Candidate', 'proof-069@example.test', dept,
              'Proof', 'Proof', 2026, 'enrolled', v_id, award)
      returning id into stu;

    -- ---- THE CANDIDATE IS VISIBLE, AND NOT YET CONFERRED ----------------
    select count(*) into n from graduation_candidate where student_id = stu;
    if n <> 1 then
      raise exception '069 FAILED: the candidate view returned % rows for one student', n;
    end if;

    select count(*) into n
      from graduation_candidate where student_id = stu and graduation_id is null;
    if n <> 1 then
      raise exception '069 FAILED: a student with no conferral was reported as conferred';
    end if;

    -- ---- THE AWARD'S OWN REQUIREMENT IS CARRIED -------------------------
    --
    -- Not a number typed into a component. That was the fault `graduation.ts`
    -- was written to correct: the Certificate Generator compared against the
    -- literal 111 at a University whose Bachelor of Theology is 180.
    select award_credits_required into n from graduation_candidate where student_id = stu;
    if n <> 24 then
      raise exception '069 FAILED: the award requirement read % rather than the award''s 24', n;
    end if;

    -- ---- A DEGREE CANNOT BE CONFERRED BEFORE THE SENATE RESOLVED --------
    --
    -- PROVE THE GUARD BY BREAKING IT. 019 set this constraint and nothing has
    -- ever exercised it, because nothing has ever written to the table.
    refused := false;
    begin
      insert into graduation_records
        (student_id, award_id, senate_approved_on, conferred_on)
        values (stu, award, date '2027-07-15', date '2027-07-01');
    exception when check_violation then
      refused := true;
    end;
    if not refused then
      raise exception
        '069 FAILED: a degree was conferred two weeks BEFORE the Senate resolved to confer it';
    end if;

    -- ---- A PROPER CONFERRAL ---------------------------------------------
    insert into graduation_records
      (student_id, award_id, senate_approved_on, conferred_on, convocation_on,
       classification, graduation_number)
      values (stu, award, date '2027-07-01', date '2027-07-15', date '2027-08-02',
              'Pass', 'IGUC/G/2027/0001')
      returning id into g_id;

    select count(*) into n
      from graduation_candidate where student_id = stu and graduation_id is not null;
    if n <> 1 then
      raise exception '069 FAILED: a conferred degree does not show on the candidate view';
    end if;

    -- ---- AND A SECOND IS REFUSED ----------------------------------------
    --
    -- 019's unique (student_id, award_id). A second conferral of the same
    -- award is a REISSUE of the certificate, not a second degree, and the
    -- difference matters on a register somebody verifies against.
    refused := false;
    begin
      insert into graduation_records
        (student_id, award_id, senate_approved_on, conferred_on)
        values (stu, award, date '2028-07-01', date '2028-07-15');
    exception when unique_violation then
      refused := true;
    end;
    if not refused then
      raise exception
        '069 FAILED: the same award was conferred on the same student twice';
    end if;

    -- ---- THE REASON COLUMN HOLDS A REASON, NOT A FLAG -------------------
    update graduation_records
       set conferred_despite = 'Senate resolved on 1 July 2027 to confer notwithstanding six '
                               || 'credits outstanding, on the medical evidence considered.'
     where id = g_id;

    select count(*) into n
      from graduation_candidate
     where student_id = stu and conferred_despite like '%medical evidence%';
    if n <> 1 then
      raise exception '069 FAILED: the recorded reason does not reach the candidate view';
    end if;

    -- ---- AND THE COHORT COUNTS IT ---------------------------------------
    select conferred_despite into n from graduation_cohort
     where conferred_on = date '2027-07-15';
    if n <> 1 then
      raise exception
        '069 FAILED: the cohort view counted % conferrals made despite an unmet requirement', n;
    end if;

    raise notice '069 OK — every candidate carries their award''s own requirement, a degree '
                 'cannot be conferred before the Senate resolved, the same award cannot be '
                 'conferred twice, and a conferral made despite an unmet requirement records '
                 'the reason in words.';

    raise exception 'PROOF_ROLLBACK';
  exception
    when others then
      if sqlerrm <> 'PROOF_ROLLBACK' then raise; end if;
  end;
end $$;
