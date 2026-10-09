-- ===========================================================================
-- 108 — NOTHING IS DELETED WITHOUT THE VICE-CHANCELLOR, AND NOT FOR 30 DAYS
-- ===========================================================================
--
-- The University's ruling:
--
--   "superadmin should be able to delete these files. when he takes delete,
--    it should appear to the VC approval. if the vc accept delete, it is
--    deleted within 30 days. if he says reject, the file is restored. all the
--    records of these processes are kept in the history."
--
-- And, asked what that covers and how it should behave:
--
--   Student records, anything with a delete today, and uploaded documents.
--   Hidden the moment the Vice-Chancellor approves, erased 30 days later.
--   A record that cannot be deleted is REFUSED AT REQUEST TIME, with the
--   reason named, rather than travelling to the Vice-Chancellor to be
--   refused there.
--
-- ---------------------------------------------------------------------------
-- WHAT CHANGES FOR THE UNIVERSITY THE MOMENT THIS RUNS
-- ---------------------------------------------------------------------------
--
-- 1. A STUDENT RECORD AND AN UPLOADED DOCUMENT CAN NO LONGER BE DELETED
--    OUTRIGHT BY ANYBODY. Not by the Superadministrator, not by the service
--    key the application writes with. A trigger refuses every DELETE that is
--    not the carrying-out of an approved request whose thirty days have run.
--
--    THIS CLOSES A DOOR THAT IS OPEN TODAY. /api/admissions/delete deletes a
--    student record at once, on the Superadministrator's say-so — which was
--    the University's earlier ruling ("only the Superadministrator may delete
--    applications") and is now narrowed by this one. That route will refuse
--    until it is changed to raise a request, which is the next commit.
--
-- 2. NOTHING ELSE IS TOUCHED. No other table gains a trigger, and nothing is
--    hidden, erased or deleted by this migration.
--
-- 3. THE THIRTY DAYS DO NOT PASS BY THEMSELVES. `erase_what_is_due()` does the
--    erasing and does nothing until the time has run. It is called by the
--    Superadministrator's screen and can be put on a schedule; until it is
--    called, an approved record is hidden and intact, which is the safe way
--    round.
--
-- ---------------------------------------------------------------------------
-- ONE TABLE FOR EVERY KIND OF RECORD, AND WHY
-- ---------------------------------------------------------------------------
--
-- A `deleted_at` column on each table would have been less code. It would also
-- have put the University's deletion policy in fourteen places, so that the
-- fifteenth table added next year would quietly not have it — which is how
-- every other "and that one too" fault in this system began.
--
-- The request names the entity by type and id. Hiding is a function the read
-- policies call; refusing is a trigger each covered table carries. Adding a
-- table to the scheme is two lines and no new policy.
-- ===========================================================================


-- ===========================================================================
-- 1. WHAT HOLDS A RECORD WHERE IT IS
-- ===========================================================================
--
-- Asked BEFORE a request is raised, so the Superadministrator learns at the
-- moment of asking rather than after the Vice-Chancellor has read it. The
-- University chose that: "refuse at request time, and say why".
--
-- EVERY REASON IS A FOREIGN KEY THE DATABASE ALREADY ENFORCES. Four things
-- restrict deleting a student today — an issued credential, an examination
-- sitting, a transcript issue and a refund request — and this names them
-- rather than inventing a policy of its own. A record the database would
-- refuse is a record the screen should refuse first, in words.
-- ---------------------------------------------------------------------------

create or replace function what_holds_this_record(kind text, subject uuid)
returns text[]
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  held text[] := '{}';
  n    integer;
begin
  if kind = 'students' then
    -- ---- 018'S RULE, AND IT IS THE STRONGEST OF THEM --------------------
    --
    -- FOUND BY THE PROOF, not by reading. `guard_application_delete` has
    -- refused to delete an ADMITTED student since 018 — "deleting it would
    -- detach a person from their own academic record" — and only an
    -- application may go. The University's own earlier ruling is the same
    -- sentence: "only the Superadministrator may delete APPLICATIONS."
    --
    -- Naming it first matters: it is the reason most of the register cannot
    -- be deleted at all, and a Superadministrator who learns it only when the
    -- erasure fails thirty days later has been told far too late.
    if exists (select 1 from students s
                where s.id = subject
                  and (s.auth_user_id is not null or s.student_number is not null)) then
      -- ARRAY-APPENDED AS ONE VALUE, not built with `||` in place. `||` is
      -- left-associative and `text[] || text` appends an element, so a
      -- sentence written across three concatenated literals becomes three
      -- separate reasons — or, as the proof found, a malformed array.
      held := array_append(held, format('%s %s %s',
        'This record has been admitted and is no longer an application.',
        'A student number, or an account, is somebody''s academic identity, and deleting',
        'the record would detach them from it. Withdraw or suspend the student instead.'));
    end if;

    select count(*) into n from credentials_issued where student_id = subject;
    if n > 0 then
      held := array_append(held, format('%s credential(s) have been issued to this student. A '
        || 'credential the University has issued is not unmade by deleting the record it '
        || 'was issued from.', n));
    end if;

    select count(*) into n from transcript_issues where student_id = subject;
    if n > 0 then
      held := array_append(held, format('%s official transcript(s) have been issued. The register of '
        || 'what the University has attested to cannot name a student it no longer has.', n));
    end if;

    select count(*) into n from exam_sessions where student_id = subject;
    if n > 0 then
      held := array_append(held, format('%s examination sitting(s) are on record. Examination evidence '
        || 'is append-only and its candidate cannot be erased from under it.', n));
    end if;

    select count(*) into n from refund_requests where student_id = subject;
    if n > 0 then
      held := array_append(held, format('%s refund request(s) name this student. A financial record '
        || 'that can be edited is not a record, and that includes editing it away.', n));
    end if;
  end if;

  return held;
end;
$$;

comment on function what_holds_this_record(text, uuid) is
  'Why a record cannot be deleted, in sentences an officer can act on. Every reason is a '
  'foreign key the database already enforces; this names them before a request is raised '
  'rather than after the Vice-Chancellor has read it.';


-- ===========================================================================
-- 2. THE REQUEST
-- ===========================================================================

create table if not exists deletion_requests (
  id              uuid primary key default gen_random_uuid(),

  -- NAMED BY TYPE AND ID, so one table serves every kind of record and a new
  -- kind needs no new table and no new policy.
  entity_type     text not null,
  entity_id       uuid not null,

  -- WHAT IT WAS, COPIED AT THE MOMENT OF ASKING. The point of the whole
  -- scheme is that the row goes away; a history that then reads
  -- "deleted 3f2a…-…" is a history of nothing.
  entity_label    text not null
    constraint a_deletion_names_what_it_is check (length(btrim(entity_label)) >= 3),

  requested_by    uuid references auth.users (id) on delete set null,
  requested_at    timestamptz not null default now(),
  reason          text not null
    constraint a_deletion_says_why check (length(btrim(reason)) >= 20),

  status          text not null default 'awaiting_decision'
    constraint deletion_request_status
    check (status in ('awaiting_decision', 'approved', 'rejected', 'erased', 'withdrawn')),

  -- ---- THE VICE-CHANCELLOR'S DECISION -----------------------------------
  decided_by      uuid references auth.users (id) on delete set null,
  decided_at      timestamptz,
  decision_reason text,

  -- THE THIRTY DAYS, written down rather than computed at read time, so the
  -- date a record becomes erasable cannot move because somebody changed a
  -- constant afterwards.
  erase_after     timestamptz,

  erased_at       timestamptz,
  restored_at     timestamptz,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  -- A DECISION HAS A DECIDER, A TIME AND A REASON, either way.
  constraint a_decided_deletion_says_who_and_why
    check (status not in ('approved', 'rejected')
           or (decided_by is not null and decided_at is not null
               and length(btrim(coalesce(decision_reason, ''))) >= 10)),

  -- AN APPROVAL CARRIES THE DATE IT BECOMES ERASABLE.
  constraint an_approved_deletion_names_its_date
    check (status <> 'approved' or erase_after is not null),

  -- AND NOTHING IS ERASED BEFORE THAT DATE. Said in the row as well as in the
  -- function, so a row claiming to have been erased early is refused by the
  -- table rather than merely unlikely.
  constraint nothing_is_erased_before_its_time
    check (erased_at is null or (erase_after is not null and erased_at >= erase_after))
);

alter table deletion_requests
  add column if not exists decision_reason text,
  add column if not exists erase_after     timestamptz,
  add column if not exists erased_at       timestamptz,
  add column if not exists restored_at     timestamptz;

create index if not exists deletion_requests_entity_idx
  on deletion_requests (entity_type, entity_id);
create index if not exists deletion_requests_open_idx
  on deletion_requests (status, requested_at desc);

-- ONE LIVE REQUEST PER RECORD. Two requests for one student is two things for
-- the Vice-Chancellor to decide and one of them forgotten.
create unique index if not exists one_live_deletion_per_record
  on deletion_requests (entity_type, entity_id)
  where status in ('awaiting_decision', 'approved');

comment on table deletion_requests is
  'A record is put up for deletion by the Superadministrator, decided by the Vice-Chancellor, '
  'hidden on approval and erased thirty days later. Rejection restores it. Nothing in this '
  'table is ever deleted: it is the history of the process.';


-- ===========================================================================
-- 3. THE HISTORY, WHICH IS APPEND-ONLY
-- ===========================================================================
--
-- "all the records of these processes are kept in the history." A history
-- somebody can edit is not a history, so this one refuses both UPDATE and
-- DELETE — the same rule 015 holds examination evidence to.
-- ---------------------------------------------------------------------------

create table if not exists deletion_request_events (
  id          uuid primary key default gen_random_uuid(),
  request_id  uuid not null references deletion_requests (id) on delete restrict,
  event       text not null,
  actor_id    uuid references auth.users (id) on delete set null,
  actor_role  text,
  detail      text,
  metadata    jsonb,
  at          timestamptz not null default now()
);

create index if not exists deletion_request_events_idx
  on deletion_request_events (request_id, at);

create or replace function a_deletion_history_is_append_only()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'The history of a deletion is append-only. It records what was asked, what '
                  'was decided and what became of the record, and none of that is editable '
                  'afterwards by any office.'
    using errcode = 'restrict_violation';
end;
$$;

drop trigger if exists a_deletion_history_is_append_only_trg on deletion_request_events;
create trigger a_deletion_history_is_append_only_trg
  before update or delete on deletion_request_events
  for each row execute function a_deletion_history_is_append_only();


-- ===========================================================================
-- 4. THE PATH, WALKED BY THE DATABASE
-- ===========================================================================
--
-- request → decision → (erased | restored), and not one step skipped. The
-- states are a path, not a set of labels.
-- ---------------------------------------------------------------------------

create or replace function a_deletion_follows_its_path()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ok boolean;
begin
  -- WHAT IS BEING DELETED IS NOT THE CALLER'S TO CHANGE. Repointing a request
  -- the Vice-Chancellor has approved at a different record would be approval
  -- obtained for one thing and spent on another.
  if new.entity_type is distinct from old.entity_type
     or new.entity_id is distinct from old.entity_id then
    raise exception 'A deletion request names one record. Raise another rather than '
                    'repointing this one.'
      using errcode = 'restrict_violation';
  end if;

  ok := case
    when old.status = new.status then true
    when old.status = 'awaiting_decision'
         and new.status in ('approved', 'rejected', 'withdrawn') then true
    -- APPROVED GOES TO ERASED WHEN THE TIME HAS RUN, OR BACK TO REJECTED IF
    -- THE VICE-CHANCELLOR CHANGES THEIR MIND WITHIN THE THIRTY DAYS. The
    -- second is the whole purpose of a grace period.
    when old.status = 'approved' and new.status in ('erased', 'rejected') then true
    else false
  end;

  if not ok then
    raise exception 'A deletion goes request → decision → erased or restored. “%” cannot '
                    'become “%”.', old.status, new.status
      using errcode = 'check_violation';
  end if;

  -- AND ERASED IS THE END. A record that has been destroyed cannot be restored
  -- by moving a status back, and pretending otherwise would be worse than
  -- saying so.
  if old.status = 'erased' and new.status <> 'erased' then
    raise exception 'That record has been erased. Nothing brings it back, and this row is '
                    'the only account of it that remains.'
      using errcode = 'restrict_violation';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists a_deletion_follows_its_path_trg on deletion_requests;
create trigger a_deletion_follows_its_path_trg
  before update on deletion_requests
  for each row execute function a_deletion_follows_its_path();


-- ===========================================================================
-- 5. HIDDEN THE MOMENT IT IS APPROVED
-- ===========================================================================
--
-- The University chose: the record leaves every screen when the Vice-Chancellor
-- approves, and is destroyed thirty days later. So the thirty days are a grace
-- period in which somebody can notice, not a period in which the record is
-- still in use.
--
-- STABLE, not immutable: it reads a table. It is called from read policies, so
-- it is `security definer` — a policy that depended on the reader also being
-- able to read `deletion_requests` would hide nothing from anybody who cannot.
-- ---------------------------------------------------------------------------

create or replace function is_awaiting_erasure(kind text, subject uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from deletion_requests
     where entity_type = kind
       and entity_id = subject
       and status = 'approved'
  );
$$;

comment on function is_awaiting_erasure(text, uuid) is
  'Whether a record has been approved for deletion and is inside its thirty days. Read by the '
  'policies that hide it from every office except the two that can still bring it back.';


-- ===========================================================================
-- 6. NOTHING IS DELETED OUTRIGHT
-- ===========================================================================
--
-- The rule the University asked for, said where it cannot be worked around.
-- The service key the application writes with is bound by a trigger and not by
-- a policy, which is why this is a trigger.
-- ---------------------------------------------------------------------------

create or replace function nothing_is_deleted_without_the_vice_chancellor()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  due boolean;
begin
  select exists (
    select 1 from deletion_requests
     where entity_type = tg_table_name
       and entity_id = old.id
       and status = 'approved'
       and erase_after <= now()
  ) into due;

  if not due then
    raise exception 'A % is not deleted outright. The Superadministrator puts it up for '
                    'deletion, the Vice-Chancellor decides, and an approved record is erased '
                    'thirty days later — a period in which rejecting the request still '
                    'brings it back.', tg_table_name
      using errcode = 'restrict_violation';
  end if;

  return old;
end;
$$;

-- TWO TABLES TO BEGIN WITH: the register the University pointed at, and the
-- uploaded documents. Adding a third is this trigger and one line in the
-- policy below — no new table and no new workflow.
drop trigger if exists nothing_is_deleted_without_the_vc_trg on students;
create trigger nothing_is_deleted_without_the_vc_trg
  before delete on students
  for each row execute function nothing_is_deleted_without_the_vice_chancellor();

drop trigger if exists nothing_is_deleted_without_the_vc_trg on documents;
create trigger nothing_is_deleted_without_the_vc_trg
  before delete on documents
  for each row execute function nothing_is_deleted_without_the_vice_chancellor();


-- ===========================================================================
-- 7. WHO SEES A REQUEST, AND WHO DECIDES ONE
-- ===========================================================================

alter table deletion_requests enable row level security;
alter table deletion_request_events enable row level security;

drop policy if exists deletion_requests_read on deletion_requests;
create policy deletion_requests_read on deletion_requests
  for select using (
    auth_role() in ('superadmin', 'admin', 'vice-chancellor', 'registrar')
  );

-- NO WRITE POLICY. Raising, deciding and erasing are the routes', under the
-- service key. A deletion request a browser could write is a deletion a
-- browser could approve.

drop policy if exists deletion_request_events_read on deletion_request_events;
create policy deletion_request_events_read on deletion_request_events
  for select using (
    auth_role() in ('superadmin', 'admin', 'vice-chancellor', 'registrar')
  );


-- ---------------------------------------------------------------------------
-- AND THE STUDENT REGISTER HIDES WHAT IS AWAITING ERASURE
-- ---------------------------------------------------------------------------
--
-- From every office EXCEPT the two that can still bring it back. A record
-- hidden from the Vice-Chancellor is a record the Vice-Chancellor cannot
-- restore, which would make the thirty days a formality.
--
-- 105's own list is reproduced rather than referred to, for the reason 105
-- gave: a policy is a sentence and half a sentence cannot be read.

drop policy if exists students_staff_read on students;
create policy students_staff_read on students
  for select using (
    (
      auth_role() in (
        'superadmin', 'admin', 'registrar', 'finance', 'finance-director',
        'admissions-officer', 'dean', 'hod', 'programme-coordinator',
        'academic-office', 'student-affairs', 'vice-chancellor', 'chancellor'
      )
      or (auth_role() = 'lecturer' and teaches_this_student(id))
    )
    and (
      not is_awaiting_erasure('students', id)
      -- THE TWO WHO CAN STILL BRING IT BACK GO ON SEEING IT.
      or auth_role() in ('superadmin', 'vice-chancellor')
    )
  );

comment on policy students_staff_read on students is
  'Who may read the student register. 105 added the Vice-Chancellor and the Chancellor, who '
  'were absent and therefore read zero students on every screen. 108 hides a record the '
  'Vice-Chancellor has approved for deletion from everybody except the Superadministrator and '
  'the Vice-Chancellor, who are the two who can still restore it within its thirty days.';


-- ===========================================================================
-- 8. ERASING WHAT IS DUE
-- ===========================================================================
--
-- IT DOES NOTHING UNTIL THE TIME HAS RUN, and that is checked here as well as
-- in the trigger. Called by the Superadministrator's screen; it can be put on
-- a schedule, and until it is called an approved record is hidden and intact —
-- which is the safe way round for a function whose job is destruction.
-- ---------------------------------------------------------------------------

create or replace function erase_what_is_due()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  r      record;
  erased integer := 0;
begin
  for r in
    select * from deletion_requests
     where status = 'approved' and erase_after <= now()
     order by erase_after
  loop
    -- THE TABLE NAME COMES FROM A LIST, NOT FROM THE ROW. `entity_type` is
    -- text, and text concatenated into a DELETE is how an injected value gets
    -- to choose what the University destroys.
    if r.entity_type = 'students' then
      delete from students where id = r.entity_id;
    elsif r.entity_type = 'documents' then
      delete from documents where id = r.entity_id;
    else
      -- A KIND THIS FUNCTION HAS NOT BEEN TAUGHT IS LEFT ALONE AND SAID OUT
      -- LOUD, never guessed at.
      raise notice '108 --  % is not a kind this function can erase; left intact',
        r.entity_type;
      continue;
    end if;

    update deletion_requests set status = 'erased', erased_at = now() where id = r.id;
    insert into deletion_request_events (request_id, event, detail)
      values (r.id, 'ERASED',
              format('%s erased after its thirty days.', r.entity_label));
    erased := erased + 1;
  end loop;

  return erased;
end;
$$;

comment on function erase_what_is_due() is
  'Destroys the records whose thirty days have run, and nothing else. Returns how many. The '
  'table is chosen from a list rather than from the row, because text concatenated into a '
  'DELETE is how an injected value chooses what gets destroyed.';


create or replace view records_awaiting_erasure
with (security_invoker = true) as
  select d.id,
         d.entity_type,
         d.entity_id,
         d.entity_label,
         d.reason,
         r.full_name  as requested_by_name,
         d.requested_at,
         v.full_name  as decided_by_name,
         d.decided_at,
         d.decision_reason,
         d.erase_after,
         greatest(0, ceil(extract(epoch from (d.erase_after - now())) / 86400))::integer
           as days_remaining,
         (d.erase_after <= now()) as due
    from deletion_requests d
    left join profiles r on r.id = d.requested_by
    left join profiles v on v.id = d.decided_by
   where d.status = 'approved';

comment on view records_awaiting_erasure is
  'Records the Vice-Chancellor has approved for deletion and which have not yet been erased, '
  'with the days left on each. Rejecting one inside its thirty days restores it.';


-- ===========================================================================
-- 9. THE PROOF
-- ===========================================================================

do $$
declare
  sup      uuid := gen_random_uuid();
  vc       uuid := gen_random_uuid();
  reg      uuid := gen_random_uuid();
  stu      uuid;
  held     uuid;
  req      uuid;
  req2     uuid;
  refused  boolean;
  seen     integer;
  held_why text[];
  state_now text;
begin
  insert into auth.users (id, email) values
    (sup, 'proof-108-super@example.invalid'),
    (vc,  'proof-108-vc@example.invalid'),
    (reg, 'proof-108-registrar@example.invalid');
  insert into profiles (id, email, full_name, role) values
    (sup, 'proof-108-super@example.invalid',     'Proof Superadmin 108',      'superadmin'),
    (vc,  'proof-108-vc@example.invalid',        'Proof Vice-Chancellor 108', 'vice-chancellor'),
    (reg, 'proof-108-registrar@example.invalid', 'Proof Registrar 108',       'registrar')
  on conflict (id) do update set role = excluded.role;

  -- A TRUE APPLICATION: no student number and no account. 018 refuses to
  -- delete anything else, and this proof is not entitled to an exception —
  -- the first draft gave it a student number, which made it admitted, and the
  -- erasure failed on 018's guard at the far end of the thirty days.
  insert into students (matric_no, first_name, last_name, status)
       values ('PROOF-108-A', 'Proof', 'Deletable-108', 'applicant')
    returning id into stu;

  -- ---- A RECORD IS NOT DELETED OUTRIGHT ---------------------------------
  --
  -- Run as the table's owner, which is stronger than the service key. If it
  -- refuses this, it refuses everything.
  refused := false;
  begin
    delete from students where id = stu;
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '108 FAILED — a student record was deleted with no request at all';
  end if;
  raise notice '108 OK  a record cannot be deleted outright, by anybody, including the '
               'service key';

  -- ---- WHAT HOLDS A RECORD IS NAMED BEFORE ANYTHING IS ASKED ------------
  held_why := what_holds_this_record('students', stu);
  if array_length(held_why, 1) is not null then
    raise exception '108 FAILED — a student with no credential was reported as held';
  end if;
  raise notice '108 OK  a record nothing holds reports nothing holding it';

  insert into students (matric_no, first_name, last_name, student_number, status)
       values ('PROOF-108-B', 'Proof', 'Graduated-108', 'PROOF-108-B', 'enrolled')
    returning id into held;
  -- THIS ONE IS HELD TWICE OVER — admitted, and holding a certificate — which
  -- is what the assertion below checks it says.
  -- A CREDENTIAL OF THIS PROOF'S OWN, at an identifier nothing else uses, so
  -- the thing holding the record is one this block made and not one of the
  -- University's.
  insert into credentials_issued (credential_id, student_id, kind, holder_name, facts,
                                  content_hash, seal_code, status, version)
       values ('PROOF-108-CERT', held, 'certificate', 'Proof Graduated-108',
               '{"proof": "108"}'::jsonb, repeat('0', 64), 'PROOF-108-SEAL', 'issued', 1);

  held_why := what_holds_this_record('students', held);
  if array_length(held_why, 1) is null then
    raise exception '108 FAILED — a graduate with an issued certificate reported as free to '
                    'delete';
  end if;
  if array_length(held_why, 1) < 2 then
    raise exception '108 FAILED — an admitted graduate holding a certificate gave only % '
                    'reason(s)', array_length(held_why, 1);
  end if;
  if held_why[1] not like '%no longer an application%'
     or not exists (select 1 from unnest(held_why) r where r like '%credential%') then
    raise exception '108 FAILED — the reasons given were "%"', held_why;
  end if;
  raise notice '108 OK  …and an admitted graduate holding a certificate names both reasons, '
               'in sentences, before the request is ever raised';

  -- ---- THE PATH ---------------------------------------------------------
  insert into deletion_requests (entity_type, entity_id, entity_label, requested_by, reason)
       values ('students', stu, 'PROOF-108-A Proof Deletable-108', sup,
               'Proof: a duplicate application raised twice by the same applicant.')
    returning id into req;
  insert into deletion_request_events (request_id, event, actor_id, actor_role, detail)
       values (req, 'REQUESTED', sup, 'superadmin', 'Put up for deletion.');

  -- ONE LIVE REQUEST PER RECORD.
  refused := false;
  begin
    insert into deletion_requests (entity_type, entity_id, entity_label, requested_by, reason)
      values ('students', stu, 'PROOF-108-A again', sup,
              'Proof: a second request for the same record, which should be refused.');
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '108 FAILED — two live deletion requests exist for one record';
  end if;
  raise notice '108 OK  one live request per record, so the Vice-Chancellor decides once';

  -- AND IT IS NOT ERASABLE BEFORE IT IS DECIDED.
  refused := false;
  begin
    update deletion_requests set status = 'erased', erased_at = now() where id = req;
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '108 FAILED — a request went straight from asking to erased';
  end if;
  raise notice '108 OK  …and nothing is erased on the asking';

  -- ---- THE VICE-CHANCELLOR APPROVES, AND IT HIDES -----------------------
  update deletion_requests
     set status = 'approved', decided_by = vc, decided_at = now(),
         decision_reason = 'Proof: approved, a duplicate record.',
         erase_after = now() + interval '30 days'
   where id = req;
  insert into deletion_request_events (request_id, event, actor_id, actor_role, detail)
       values (req, 'APPROVED', vc, 'vice-chancellor', 'Approved for deletion in 30 days.');

  set local role authenticated;
  perform set_config('request.jwt.claim.sub', reg::text, true);
  select count(*) into seen from students where id = stu;
  reset role;
  if seen <> 0 then
    raise exception '108 FAILED — the Registrar can still see a record approved for deletion';
  end if;
  raise notice '108 OK  an approved record leaves every screen at once';

  -- BUT NOT THE TWO WHO CAN BRING IT BACK. A record the Vice-Chancellor
  -- cannot see is a record they cannot restore, and the thirty days would be
  -- a formality.
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', vc::text, true);
  select count(*) into seen from students where id = stu;
  reset role;
  if seen <> 1 then
    raise exception '108 FAILED — the Vice-Chancellor cannot see what they must be able to '
                    'restore';
  end if;
  raise notice '108 OK  …except for the Superadministrator and the Vice-Chancellor, who can '
               'still restore it';

  -- ---- AND IT IS STILL NOT ERASED -------------------------------------
  select erase_what_is_due() into seen;
  if seen <> 0 then
    raise exception '108 FAILED — % record(s) were erased on the day they were approved', seen;
  end if;
  select count(*) into seen from students where id = stu;
  if seen <> 1 then
    raise exception '108 FAILED — the record was destroyed inside its thirty days';
  end if;
  raise notice '108 OK  thirty days means thirty days: nothing is erased on approval';

  -- ---- REJECTION RESTORES IT -------------------------------------------
  update deletion_requests
     set status = 'rejected', decision_reason = 'Proof: on reflection, it is not a duplicate.',
         restored_at = now()
   where id = req;
  insert into deletion_request_events (request_id, event, actor_id, actor_role, detail)
       values (req, 'RESTORED', vc, 'vice-chancellor', 'Rejected; the record is restored.');

  set local role authenticated;
  perform set_config('request.jwt.claim.sub', reg::text, true);
  select count(*) into seen from students where id = stu;
  reset role;
  if seen <> 1 then
    raise exception '108 FAILED — a rejected deletion did not restore the record';
  end if;
  raise notice '108 OK  rejecting it inside the thirty days puts it back on every screen';

  -- ---- WHEN THE TIME HAS RUN, IT GOES ----------------------------------
  insert into deletion_requests (entity_type, entity_id, entity_label, requested_by, reason,
                                 status, decided_by, decided_at, decision_reason, erase_after)
       values ('students', stu, 'PROOF-108-A Proof Deletable-108', sup,
               'Proof: the thirty days have run and this one is due.',
               'approved', vc, now() - interval '31 days',
               'Proof: approved a month ago.', now() - interval '1 day')
    returning id into req2;

  select erase_what_is_due() into seen;
  if seen <> 1 then
    raise exception '108 FAILED — % record(s) erased when one was due', seen;
  end if;
  select count(*) into seen from students where id = stu;
  if seen <> 0 then
    raise exception '108 FAILED — a record whose time had run was not erased';
  end if;
  raise notice '108 OK  …and when the thirty days have run, it is erased';

  -- ---- THE HISTORY SURVIVES THE RECORD ----------------------------------
  --
  -- The point of the whole scheme. The student is gone; what was asked, who
  -- decided it and what became of it are not.
  select count(*) into seen from deletion_request_events where request_id = req;
  if seen < 3 then
    raise exception '108 FAILED — the history of the request has % entries', seen;
  end if;
  -- READ INTO A TEXT VARIABLE, not into an element of the reasons array.
  -- `select into held_why[1]` is not a subscript assignment in plpgsql; it
  -- tries to select into a scalar and fails on the array's own type.
  select status into state_now from deletion_requests where id = req2;
  if state_now <> 'erased' then
    raise exception '108 FAILED — the request does not record that it was carried out';
  end if;
  raise notice '108 OK  the record is gone and the account of why is not';

  -- ---- AND THE HISTORY CANNOT BE EDITED ---------------------------------
  refused := false;
  begin
    update deletion_request_events set detail = 'something else' where request_id = req;
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '108 FAILED — the history of a deletion was edited';
  end if;
  refused := false;
  begin
    delete from deletion_request_events where request_id = req;
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '108 FAILED — the history of a deletion was deleted';
  end if;
  raise notice '108 OK  …and that account is append-only, like every other record of a '
               'decision in this system';

  -- ---- ERASED IS THE END ------------------------------------------------
  refused := false;
  begin
    update deletion_requests set status = 'rejected' where id = req2;
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '108 FAILED — an erased record was marked restored, which it cannot be';
  end if;
  raise notice '108 OK  an erased record is not restorable, and the system does not pretend '
               'otherwise';

  raise exception 'ROLLBACK 108';
exception
  when others then
    if sqlerrm = 'ROLLBACK 108' then
      raise notice '108 OK  every proof above rolled back; no record of the University''s was '
                   'hidden, erased or written to';
    else
      raise;
    end if;
end $$;


-- ===========================================================================
-- 10. DONE
-- ===========================================================================
do $$
begin
  raise notice '108 APPLIED  a student record and an uploaded document can no longer be '
               'deleted outright by anybody. The Superadministrator puts one up, the '
               'Vice-Chancellor decides, an approved record hides at once and is erased '
               'thirty days later, and rejecting it inside that window restores it. '
               '/api/admissions/delete will refuse until it is changed to raise a request.';
end $$;
