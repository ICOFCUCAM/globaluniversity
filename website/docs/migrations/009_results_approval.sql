-- ===========================================================================
-- ICOF GLOBAL UNIVERSITY — THE GRADE APPROVAL CHAIN
--
-- Run after 008_admission_openings.sql. Idempotent; destroys nothing.
--
-- ---------------------------------------------------------------------------
-- WHY
--
-- Two faults, and together they meant no degree could ever be conferred.
--
-- FAULT ONE — THE CHAIN HAD NO IMPLEMENTATION. Both places a mark can be
-- entered wrote status 'draft', and nothing in the system ever wrote anything
-- else. /api/results/recompute marks a term's average `provisional` unless
-- every mark in it is approved, and /api/credential/issue refuses to issue
-- against a provisional average. Both were behaving correctly. The input was
-- simply never going to arrive: the certificate artwork, the seal, the
-- verification page, the issuance register and the GPA engine were all built
-- and none of them was reachable, because a mark could not become an approved
-- mark.
--
-- FAULT TWO — NOBODY COULD READ OR WRITE A MARK AT ALL. `results` has RLS
-- enabled and exactly one policy on it:
--
--     create policy results_own on results for select using (
--       student_id in (select id from students where auth_user_id = auth.uid())
--     );
--
-- A student may read their own marks. That is the whole policy set. There is no
-- staff SELECT, and there is no INSERT or UPDATE policy for anybody — so the
-- Grade Book's `supabase.from('results').insert(...)` was refused by RLS every
-- time it ran. A lecturer entering a class of marks got an error per row from a
-- browser client, and the Head of Department could not have read them if they
-- had saved.
--
-- This migration fixes both: the states and the audit trail the chain needs,
-- and the read policy staff must have. Writing stays closed to browsers on
-- purpose — see section 4.
--
-- ---------------------------------------------------------------------------
-- THE CHAIN IS THE UNIVERSITY'S, NOT MINE
--
-- `gradeApproval` in src/lib/lifecycle.ts already publishes it:
--
--     1  Lecturer            submits marks for the courses they teach
--     2  Head of Department  moderates the marks
--     3  Dean                approves the moderated marks for the faculty
--     4  Registrar           approves for publication, writing the record
--     5  System              recomputes GPA
--
-- and states: "No step may be skipped, including by an administrator. A result
-- published without moderation is a result the university cannot defend on
-- appeal." That page is read by prospective students and by accreditors. The
-- states below are those steps, so the claim is true of the system and not only
-- of the page.
-- ===========================================================================


-- ===========================================================================
-- 1. THE STATES
--
-- The column already exists and already defaults to 'draft'. What it has never
-- had is a constraint, so any string at all was a valid status — including a
-- typo, which would have read as "not approved" everywhere and silently frozen
-- a class forever with nothing to show why.
-- ===========================================================================

alter table results
  add column if not exists moderated_by         uuid,
  add column if not exists moderated_at         timestamptz,
  add column if not exists faculty_approved_by  uuid,
  add column if not exists faculty_approved_at  timestamptz,
  -- Why a class was sent back. Required by the API when returning: a class
  -- returned without a reason tells the lecturer somebody objected and nothing
  -- about what to change, which produces a second submission identical to the
  -- first.
  add column if not exists returned_reason      text,
  add column if not exists returned_by          uuid,
  add column if not exists returned_at          timestamptz;

-- Existing rows first, or the constraint below fails on live data. Anything
-- that is not one of the five known states is treated as a draft, which is the
-- safe direction: it means "not yet approved" and costs a resubmission, whereas
-- guessing upwards would publish marks nobody approved.
update results
set status = 'draft'
where status is null
   or status not in ('draft', 'submitted', 'moderated', 'faculty-approved', 'approved');

alter table results drop constraint if exists results_status_known;
alter table results add constraint results_status_known
  check (status in ('draft', 'submitted', 'moderated', 'faculty-approved', 'approved'));

-- The queue reads "everything at this stage", and the recompute reads
-- "everything for this student". Neither had an index for it.
create index if not exists results_status_idx         on results (status);
create index if not exists results_course_status_idx  on results (course_id, status);


-- ===========================================================================
-- 2. THE AUDIT TRAIL
--
-- lifecycle.ts promises "Every action is timestamped and attributed" and lists
-- "Audit entry per step" among what this workflow writes. The columns above
-- record the CURRENT state — who moderated it, when. They cannot record a
-- history, because returning a class clears them: a class moderated, returned,
-- corrected and moderated again would show only the second moderation, and the
-- first would be gone as though it had never happened.
--
-- That is exactly the record an appeal turns on. So every step, forward or
-- back, is also appended here and nothing in this table is ever updated or
-- deleted.
-- ===========================================================================

create table if not exists result_transitions (
  id           uuid primary key default gen_random_uuid(),
  result_id    uuid not null references results (id) on delete cascade,

  from_status  text not null,
  to_status    text not null,

  -- 'advance' or 'return'. Derivable from the two statuses, stored anyway
  -- because the question asked of this table is almost always "was this class
  -- ever sent back, and why", and that should not require reasoning about the
  -- order of five strings.
  action       text not null check (action in ('advance', 'return')),

  actor_id     uuid,
  -- The role AT THE TIME. Roles change; a record that resolves the actor's role
  -- by lookup would restate history every time somebody is promoted.
  actor_role   text,
  actor_name   text,

  note         text,
  created_at   timestamptz not null default now()
);

create index if not exists result_transitions_result_idx on result_transitions (result_id, created_at);
create index if not exists result_transitions_actor_idx  on result_transitions (actor_id);


-- ===========================================================================
-- 3. THE FOUR-PEOPLE RULE, AT THE DATABASE
--
-- Nobody may sign the same class twice, at any step.
--
-- The API enforces this too, in src/lib/resultsWorkflow.ts, and that is where
-- the person gets a sentence explaining the refusal. This trigger exists
-- because the API is one caller and the service-role key is not: anything
-- holding it — a script, a future route, a console — bypasses every check
-- written in TypeScript. A rule that four different people must look at a set
-- of marks is not a validation, it is the reason the chain exists, and it
-- belongs where it cannot be routed around.
--
-- WHY NOT JUST "NOT TWO CONSECUTIVE STEPS", which is the obvious rule? Because
-- `admin` is defined as every operational capability, so an administrator holds
-- all four steps. Under the consecutive rule an administrator and one colleague
-- could alternate and walk a class from draft to the academic record with four
-- signatures representing two opinions — satisfying "no step skipped" on paper
-- while skipping two in substance.
--
-- The cost is real and is the correct cost: where one person holds two offices
-- in the chain, that class stops until somebody else is available. A university
-- that cannot find four people to look at a set of marks does not have an
-- approval chain, and the database should say so rather than simulate one.
-- ===========================================================================

create or replace function results_distinct_signatories()
returns trigger
language plpgsql
as $$
declare
  signers uuid[];
begin
  signers := array_remove(
    array[new.submitted_by, new.moderated_by, new.faculty_approved_by, new.approved_by],
    null
  );

  -- cardinality(), not array_length(). array_length('{}', 1) is NULL, not 0, so
  -- an unsigned row — every newly entered mark — would compare NULL against a
  -- count and raise. That would have refused every insert the Grade Book makes,
  -- which is a spectacular way to fix a bug by replacing it with a worse one.
  if cardinality(signers) <> (select count(distinct s) from unnest(signers) as s) then
    raise exception
      'The same person appears twice in the approval chain for this result. Four approvals from '
      'one person is one opinion recorded four times.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists results_distinct_signatories_trg on results;
create trigger results_distinct_signatories_trg
  before insert or update on results
  for each row execute function results_distinct_signatories();


-- ===========================================================================
-- 4. RLS
--
-- STAFF MAY READ. Without this the Grade Book shows an empty class, the
-- approval queue shows nothing, and the Head of Department cannot see the marks
-- they are being asked to moderate. This was the state of the system: only the
-- student could read a result, and staff could read none at all.
--
-- The list is the offices that have a reason to see a mark before it is
-- published — the chain itself, plus the Registry and the Academic Office who
-- answer for the record. A Finance officer is absent: fees are not marks.
--
-- NO WRITE POLICY, AND THAT IS THE DESIGN. Every write goes through
-- /api/results/save and /api/results/advance, which hold the service role and
-- are guarded by capability. A browser cannot write a mark.
--
-- This is not caution for its own sake. If browsers could write marks under
-- RLS, the check on WHO may move a class from 'moderated' to 'approved' would
-- have to be expressible as a row predicate — and it is not: it depends on the
-- caller's capability, on which step the class is at, and on who has already
-- signed it. RLS cannot see the first and cannot express the third. The rule
-- would end up as "staff may update results", which is not the rule.
--
-- The existing student policy is left exactly as it is.
-- ===========================================================================

drop policy if exists results_staff_read on results;
create policy results_staff_read on results
  for select using (
    auth_role() in (
      'superadmin', 'admin', 'registrar', 'academic-office',
      'dean', 'hod', 'programme-coordinator', 'lecturer'
    )
  );

alter table result_transitions enable row level security;

-- The same offices may read the history. A student is deliberately absent: the
-- trail records internal deliberation — who sent a class back and why — and
-- publishing that to the class is a different decision for the university to
-- take deliberately, not a side effect of a migration.
drop policy if exists result_transitions_staff_read on result_transitions;
create policy result_transitions_staff_read on result_transitions
  for select using (
    auth_role() in (
      'superadmin', 'admin', 'registrar', 'academic-office',
      'dean', 'hod', 'programme-coordinator', 'lecturer'
    )
  );

-- No write policy here either. The trail is written by the same guarded routes,
-- and an append-only record that a browser can append to is not append-only.


-- ===========================================================================
-- 5. VERIFY
-- ===========================================================================

select status, count(*) from results group by status order by status;

select
  count(*) filter (where status = 'draft')            as draft,
  count(*) filter (where status = 'submitted')        as awaiting_moderation,
  count(*) filter (where status = 'moderated')        as awaiting_faculty,
  count(*) filter (where status = 'faculty-approved') as awaiting_publication,
  count(*) filter (where status = 'approved')         as published
from results;

select tablename, policyname, cmd
from pg_policies
where tablename in ('results', 'result_transitions')
order by tablename, policyname;


-- ===========================================================================
-- AFTER RUNNING THIS
--
-- Nothing is approved by this migration. Every existing mark stays a draft,
-- which is what it already was — the states and the trail now exist, and marks
-- move through them when the offices act.
--
-- To get the first degree out of the system:
--
--   1. A lecturer enters marks (Grade Book) and presses Submit.
--   2. A Head of Department moderates them (Records → Result approval).
--   3. A Dean approves them for the faculty.
--   4. The Registrar approves them for publication. GPAs recompute
--      automatically at this step — no second button, because a correct
--      approval that still cannot produce a certificate because somebody
--      forgot to press Recompute is the same failure this migration exists to
--      end.
--   5. The average for that term becomes `basis = 'approved'`, and
--      /api/credential/issue will issue against it.
--
-- FOUR DIFFERENT PEOPLE ARE REQUIRED. If the same account tries to perform two
-- of the four steps it is refused, by the API with an explanation and by the
-- trigger above regardless of caller. Appoint the offices — see the role
-- assignment screen — before a term's marks are due.
-- ===========================================================================
