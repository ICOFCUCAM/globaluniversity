-- ===========================================================================
-- 025 — THE STATE LIST IS THE SOFTWARE'S; THE DECISIONS ARE THE UNIVERSITY'S
--
-- Run after 024. Idempotent; destroys nothing.
--
-- ---------------------------------------------------------------------------
-- THE DISTINCTION THIS MIGRATION ENFORCES
-- ---------------------------------------------------------------------------
--
-- The University drew the line and it is the right one:
--
--   REFERENCE VOCABULARY is controlled by the software. `admission_states` is
--   a list of identifiers the application branches on. Somebody renaming
--   `ready_for_academic_review` to `Waiting for Academic Decision` in the SQL
--   editor breaks every filter, report, permission check and screen that names
--   it — silently, and not at the moment they do it.
--
--   INSTITUTIONAL DECISIONS are controlled by the officers who hold them. Which
--   programmes are open, and who was admitted, are the University's to change
--   and the software's to record.
--
-- 024 seeded the states with `on conflict do update`, which already made the
-- seed authoritative — an edit was silently reverted on the next migration run.
-- Silently is the problem. This refuses the edit at the moment it is attempted,
-- with a message saying why, instead of letting somebody believe it worked for
-- a fortnight.
--
-- ---------------------------------------------------------------------------
-- AND THE PART THAT MUST STAY EDITABLE
-- ---------------------------------------------------------------------------
--
-- The University asked for the split, and it is the reason the lock is on the
-- code and not on the row:
--
--   code   ready_for_academic_review    the application branches on this
--   label  Ready for Academic Review    the reader sees this
--
-- So the wording CAN be changed — to "Awaiting Academic Decision", or into
-- French — without touching a line of application code, and the identifier
-- cannot. A lock over the whole row would have made the labels unusable, which
-- is the opposite of what the split is for.
-- ===========================================================================


-- ===========================================================================
-- 1. THE LABEL, BESIDE THE CODE
--
-- 024 carried `applicant_label` — what the APPLICANT is told, which is
-- deliberately vaguer than the truth (an applicant is shown "Under academic
-- review" for four internal states). What was missing is the staff-facing
-- label: the words the Head of Academic Affairs' own queue should show.
-- ===========================================================================

alter table admission_states add column if not exists label text;

update admission_states set label = coalesce(label, initcap(replace(state, '_', ' ')));

-- The University's own wording, where it differs from a mechanical prettifier.
-- `conditional` and `applicant` keep their CODES — those are live values in the
-- students table and renaming a status in service is a data migration with
-- nothing to gain — and take the labels the University actually uses.
update admission_states set label = v.label from (values
  ('draft',                     'Draft'),
  ('applicant',                 'Submitted'),
  ('under_review',              'Under Review'),
  ('documents_required',        'Documents Required'),
  ('documents_verified',        'Documents Verified'),
  ('fee_pending',               'Fee Pending'),
  ('fee_paid',                  'Fee Cleared'),
  ('ready_for_academic_review', 'Ready for Academic Review'),
  ('approved',                  'Approved'),
  ('conditional',               'Conditionally Approved'),
  ('returned',                  'Returned for Correction'),
  ('rejected',                  'Rejected'),
  ('admission_issued',          'Admission Issued'),
  ('enrolled',                  'Enrolled'),
  ('withdrawn',                 'Withdrawn')
) as v(state, label) where admission_states.state = v.state;

alter table admission_states alter column label set not null;


-- ===========================================================================
-- 2. THE CODE AND THE STAGE ARE THE SOFTWARE'S
--
-- Refused at the moment of the edit rather than reverted on the next migration.
-- The labels are untouched by this — changing them is the whole point of
-- keeping them separate from the code.
-- ===========================================================================

create or replace function admission_states_code_is_software() returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    raise exception
      'admission_states is the software''s vocabulary: % cannot be deleted, because the application branches on it', old.state;
  end if;
  if tg_op = 'INSERT' then
    raise exception
      'a new admission state is a code change, not a row: add it to src/lib/admissionWorkflow.ts and a migration, so the application and the database learn it together';
  end if;
  if new.state is distinct from old.state then
    raise exception
      'the state code % cannot be renamed — every filter, report and permission check names it. Change `label` instead, which is what the reader sees.', old.state;
  end if;
  if new.stage is distinct from old.stage then
    raise exception
      'the stage of % is part of the workflow, not presentation, and cannot be edited here', old.state;
  end if;
  return new;
end;
$$;

drop trigger if exists admission_states_locked on admission_states;
-- The migration itself must be able to seed and correct rows, so the trigger is
-- dropped and recreated around the seed in section 1 rather than fighting it —
-- see the ordering: this is created AFTER the updates above.
create trigger admission_states_locked
  before insert or update or delete on admission_states
  for each row execute function admission_states_code_is_software();


-- ===========================================================================
-- 3. THE AUDIT RECORDS AUTHORITY, NOT ONLY THE PERSON
--
-- The University's point: `decided_by = 12345` says a user acted. What an audit
-- has to establish is that the HEAD OF ACADEMIC AFFAIRS, ACTING UNDER THE
-- ACADEMIC AFFAIRS AUTHORITY, moved this application from
-- ready_for_academic_review to approved at a stated time, for a stated reason.
--
-- The person, the role and the office are three different facts. A person holds
-- a role; a role exercises an office's authority; and when the
-- Superadministrator acts in Academic Affairs' place the person and the office
-- are deliberately not the same, which is exactly the case an audit exists for.
-- ===========================================================================

alter table admission_audit_log add column if not exists actor_office text;
alter table admission_audit_log add column if not exists previous_state text;
alter table admission_audit_log add column if not exists new_state text;
alter table admission_audit_log add column if not exists reason text;
-- Anything the event needs that is not worth a column: the student number
-- reserved, the SMTP failure, the size of the package. jsonb rather than more
-- columns so a new event does not need a migration.
alter table admission_audit_log add column if not exists metadata jsonb;

create index if not exists admission_audit_log_office_idx on admission_audit_log (actor_office, at desc);


-- ===========================================================================
-- 4. PERFORMING THE RULES
-- ===========================================================================

do $$
declare
  refused boolean;
  lbl text;
begin
  -- ---- THE CODE CANNOT BE RENAMED --------------------------------------
  refused := false;
  begin
    update admission_states set state = 'waiting_for_academic_decision'
     where state = 'ready_for_academic_review';
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '025 FAILED: a state code was renamed';
  end if;

  -- ---- NOR DELETED, NOR ADDED BY HAND ----------------------------------
  refused := false;
  begin
    delete from admission_states where state = 'approved';
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '025 FAILED: a state was deleted';
  end if;

  refused := false;
  begin
    insert into admission_states (state, stage, applicant_label, label, sort_order)
    values ('invented_state', 'academic', 'x', 'x', 999);
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '025 FAILED: a state was invented in the database';
  end if;

  -- ---- BUT THE LABEL IS THE UNIVERSITY'S TO WORD -----------------------
  -- The whole reason the code and the label are separate columns.
  update admission_states set label = 'Awaiting Academic Decision'
   where state = 'ready_for_academic_review';
  select label into lbl from admission_states where state = 'ready_for_academic_review';
  if lbl <> 'Awaiting Academic Decision' then
    raise exception '025 FAILED: the label could not be changed, which defeats the split';
  end if;
  -- Put it back, so the migration leaves the University's wording in place.
  update admission_states set label = 'Ready for Academic Review'
   where state = 'ready_for_academic_review';

  -- ---- THE AUDIT CAN NAME THE OFFICE AND BOTH STATES -------------------
  perform 1 from information_schema.columns
   where table_name = 'admission_audit_log'
     and column_name in ('actor_office', 'previous_state', 'new_state', 'metadata');
  if not found then
    raise exception '025 FAILED: the audit log cannot record the authority behind an event';
  end if;

  raise notice '025 OK — a state code cannot be renamed, deleted or invented, its label can be '
               'reworded, and the audit log records the office as well as the person.';
end $$;


-- ===========================================================================
-- 5. VERIFY
-- ===========================================================================

select state as code, label, applicant_label, stage
from admission_states order by sort_order;
