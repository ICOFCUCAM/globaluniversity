-- ===========================================================================
-- 056 — WHAT AN OFFICE MAY NOT EVEN SEE
-- ===========================================================================
--
-- WHAT CHANGES FOR THE UNIVERSITY THE MOMENT THIS RUNS
--
-- THE CERTIFICATE AND TRANSCRIPT DESIGNS STOP BEING READABLE BY EVERYBODY.
-- Until this file runs, the policy on `credential_templates` is:
--
--     create policy credential_templates_read on credential_templates
--       for select using (true);
--
-- `using (true)` is not "every member of staff". It is EVERY CALLER THE
-- PUBLISHABLE KEY BELONGS TO — every applicant, every student, every lecturer,
-- and every visitor who opens the site without signing in at all. The rows it
-- serves are the blank certificate and the blank transcript: border, seal
-- placement, crest position, typeface, every measurement that makes a
-- University document look like one.
--
-- The University put it plainly: some accounts must not SEE these, not merely
-- be unable to edit them. Read-only was never the safe half of the problem.
-- A design nobody can edit and anybody can read is a design anybody can copy.
--
-- AND THE APPOINTMENT REGISTER GETS THREE BANDS instead of one list. An HR
-- officer sees the files on their own desk. The Registrar sees the whole
-- register, executive appointments included — the University has ruled that.
--
-- AND AN EXECUTIVE POST MAY ONLY BE FILLED BY THE APPOINTING AUTHORITY.
--
-- AND THE SUPERADMINISTRATOR GETS THE SWITCH — as time-boxed, audited grants
-- rather than a setting, for the reason in section 6.
--
-- ---------------------------------------------------------------------------
-- WHAT THIS FILE DOES NOT DO, AND WHY
-- ---------------------------------------------------------------------------
--
-- IT DOES NOT RANK THE OFFICES. The obvious rule — "you may not appoint to a
-- post more senior than your own" — needs an orderable seniority for every
-- office, and the University has not stated one. 053 recorded `precedence` as
-- PROSE, for printing, and said so in the column comment: "Never derived."
-- Turning that sentence into a number would mean inventing the ladder, which
-- is the one thing this codebase may not do.
--
-- So section 5 uses only the fact 053 actually recorded — that an office is
-- marked executive — and refuses those to everybody but the appointing
-- authority. It is the narrow, true version of the rule. The full ladder is
-- available the day the University states it.
-- ===========================================================================


-- ===========================================================================
-- 1. SIX OFFICES THE APPLICATION HAS AND THE DATABASE WOULD NOT STORE
-- ===========================================================================
--
-- Found while writing the proof for section 2, by trying to make somebody an
-- HR officer:
--
--     new row for relation "profiles" violates check constraint
--     "profiles_role_valid"
--
-- `profiles.role` carries seventeen roles. `src/lib/roles.ts` defines
-- twenty-three. These six exist in the application, hold capabilities in the
-- matrix, are offered by the role picker, and cannot be written to a profile:
--
--     hr-officer          hr-administrator
--     exam-officer        examiner
--     invigilator         moderator
--
-- WHAT THAT MEANT IN PRACTICE. `draft-appointment` is held by superadmin,
-- admin, vice-chancellor, hr-officer and hr-administrator — and two of those
-- five are roles no account could ever hold. The examination offices are the
-- same story: 015 and 016 built proctoring around an Examination Officer, an
-- examiner, a moderator and an invigilator, and not one of them could be
-- assigned. Every capability granted to these six was unreachable, and
-- nothing said so, because assigning the role fails at the moment somebody
-- tries it rather than at the moment the matrix was written.
--
-- This is fixed here rather than in its own file because section 2 cannot be
-- PROVED without it: a band for the officer who drafted the appointment is
-- untestable while no such officer can exist.
--
-- src/lib/schemaContract.test.mjs now compares the two lists on every run, so
-- the next role added to one has to be added to the other.

do $$
begin
  if exists (select 1 from pg_constraint where conname = 'profiles_role_valid') then
    alter table profiles drop constraint profiles_role_valid;
  end if;

  alter table profiles add constraint profiles_role_valid
    check (role in (
      -- Custody of the system, as distinct from office in the University.
      'superadmin', 'admin',
      -- The University's offices, in the order roles.ts states them.
      'chancellor', 'vice-chancellor', 'registrar', 'finance-director',
      'dean', 'hod', 'programme-coordinator',
      -- THE EXAMINATION OFFICES. 015 and 016 wrote the proctoring system
      -- around these four and none could be assigned to anybody.
      'exam-officer', 'moderator', 'examiner', 'invigilator',
      'lecturer', 'finance', 'admissions-officer', 'library-staff',
      'student-affairs',
      -- HUMAN RESOURCES. The offices that hold 'draft-appointment'.
      'hr-officer', 'hr-administrator',
      'student', 'applicant',
      -- Predates the hierarchy; takes the academic admission decision.
      'academic-office'
    ));
end $$;


-- ===========================================================================
-- 2. THE BLANK CERTIFICATE IS NOT PUBLIC
-- ===========================================================================
--
-- WHO KEEPS THIS ROW, taken from the capabilities and nowhere else:
--
--   superadmin       design-credentials, publish-credential-template
--   admin            issue-credential
--   registrar        issue-credential, approve-credential-design
--   academic-office  issue-credential, approve-credential-design
--   vice-chancellor  approve-credential-design
--
-- Nobody else has a reason to hold the blank. A student reads their OWN
-- issued credential through `credentials_issued`, which 004 already scoped to
-- them, and that row carries the finished document — not the template it was
-- struck from.

drop policy if exists credential_templates_read on credential_templates;
create policy credential_templates_read on credential_templates
  for select using (
    auth_role() in ('superadmin', 'admin', 'registrar', 'academic-office', 'vice-chancellor')
  );

comment on table credential_templates is
  'The blank certificate and the blank transcript. Restricted to the offices that design, '
  'approve or issue from them — 056. Read-only is not safe on its own: a design anybody can '
  'read is a design anybody can reproduce.';


-- ===========================================================================
-- 3. THE APPOINTMENT REGISTER IN THREE BANDS
-- ===========================================================================
--
-- 041's policy was:
--
--     person_id = auth.uid() or auth_role() in ('superadmin','admin','registrar')
--
-- which has a hole at each end. `hr-officer`, `hr-administrator` and the
-- VICE-CHANCELLOR all hold 'draft-appointment' and none of them is on that
-- list, so the Appointments screen renders an empty table for every one of
-- them. The Superadministrator never saw it because the Superadministrator is
-- waved through.
--
-- 055 has just given the Vice-Chancellor the authority to take an appointment
-- from draft to approval alone. Under 041's policy the VC could create one and
-- then not see it.
--
-- THE THREE BANDS
--
--   YOURS         — the appointment naming you. 041 had this and it stays:
--                   nobody should write to HR to find out what they were
--                   appointed as.
--   ON YOUR DESK  — you drafted it, you authorised it, or it was initiated in
--                   your name. This is the band that was missing, and it is
--                   the one that makes the screen work for the officers whose
--                   job it is.
--   THE REGISTER  — the whole thing. The University has ruled that the
--                   Registrar sees all of it, executive appointments
--                   included; the Registrar keeps the register of the
--                   University's officers and a register with holes in it is
--                   not a register.
--
-- WHAT IS DELIBERATELY ABSENT: `hr-officer` and `hr-administrator` are not in
-- the third band. They see their own work, which is what the University means
-- by "it is not even their place."

drop policy if exists appointments_read on appointments;
create policy appointments_read on appointments
  for select using (
    -- YOURS
    person_id = auth.uid()
    -- ON YOUR DESK
    or drafted_by = auth.uid()
    or authorized_by = auth.uid()
    or initiated_by = auth.uid()
    or reviewed_by = auth.uid()
    or issued_by = auth.uid()
    -- THE REGISTER
    or auth_role() in ('superadmin', 'admin', 'registrar', 'vice-chancellor', 'chancellor')
  );

-- THE LETTER FOLLOWS THE APPOINTMENT. A letter visible to somebody the
-- appointment is not would be the same disclosure by a longer route — the
-- letter carries the salary in words.
drop policy if exists appointment_letters_read on appointment_letters;
create policy appointment_letters_read on appointment_letters
  for select using (
    auth_role() in ('superadmin', 'admin', 'registrar', 'vice-chancellor', 'chancellor')
    or exists (select 1 from appointments a
                where a.id = appointment_letters.appointment_id
                  and (a.person_id = auth.uid()
                       or a.drafted_by = auth.uid()
                       or a.authorized_by = auth.uid()
                       or a.initiated_by = auth.uid()))
  );

-- AND SO DOES THE HISTORY. 041 gave the events to superadmin/admin/registrar
-- only, which means an HR officer cannot see the history of the appointment
-- they themselves drafted — the screen shows the row and then nothing about
-- how it got there.
drop policy if exists appointment_events_read on appointment_events;
create policy appointment_events_read on appointment_events
  for select using (
    auth_role() in ('superadmin', 'admin', 'registrar', 'vice-chancellor', 'chancellor')
    or exists (select 1 from appointments a
                where a.id = appointment_events.appointment_id
                  and (a.person_id = auth.uid()
                       or a.drafted_by = auth.uid()
                       or a.authorized_by = auth.uid()
                       or a.initiated_by = auth.uid()))
  );


-- ===========================================================================
-- 4. THE ALLOWANCES ARE THE SALARY BY ANOTHER NAME
-- ===========================================================================
--
-- 041 held the salary back from the ordinary screens and built
-- `appointments_without_pay` for the purpose, with the reasoning: "who holds
-- which post is ordinary institutional information; what they are paid is
-- not."
--
-- 047 then added `appointment_allowances` — housing, transport, responsibility
-- — as rows in their own table. They are money, they are on the same
-- appointment, and holding back the salary column while serving the
-- allowances row is holding back nothing at all.

do $$
begin
  if to_regclass('public.appointment_allowances') is not null then
    drop policy if exists appointment_allowances_read on appointment_allowances;
    create policy appointment_allowances_read on appointment_allowances
      for select using (
        auth_role() in ('superadmin', 'admin', 'registrar', 'vice-chancellor',
                        'chancellor', 'finance-director')
        or exists (select 1 from appointments a
                    where a.id = appointment_allowances.appointment_id
                      and a.person_id = auth.uid())
      );
  end if;
end $$;


-- ===========================================================================
-- 5. AN EXECUTIVE POST IS THE APPOINTING AUTHORITY'S TO FILL
-- ===========================================================================
--
-- This is the University's "it is not even their place", in the only form the
-- recorded facts support.
--
-- 053 marks an office executive by recording `executive_level` against it. It
-- has done so for one post so far — the Director of Academic Affairs, the
-- second-ranking officer after the Vice-Chancellor — and the University adds
-- others by filling that column, not by editing this file.
--
-- An appointment TO such a post may only be initiated by the Vice-Chancellor,
-- the Chancellor, or the system account. An HR officer may prepare anything
-- else; they may not put the University's second-ranking officer in post.
--
-- WHY A TRIGGER AND NOT A CHECK CONSTRAINT: the rule reads a column on a
-- DIFFERENT row — positions.executive_level — and a check constraint may only
-- see the row it is on.
--
-- WHY IT READS `initiated_by_office` AND NOT THE CALLER'S ROLE: every write to
-- this table goes through /api/appointments with the service key, which
-- carries no role claim, so auth_role() is 'anon' at write time and would
-- refuse everybody. `initiated_by_office` is the route's statement of which
-- office is acting, and 045 built it for exactly this.

create or replace function refuse_executive_appointment_from_below()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  level text;
  post  text;
begin
  if new.position_id is null then return new; end if;

  select p.executive_level, p.title into level, post
    from positions p where p.id = new.position_id;

  if level is null or btrim(level) = '' then return new; end if;

  if coalesce(new.initiated_by_office, '') not in ('vice-chancellor', 'chancellor', 'system') then
    raise exception
      '% is an executive office of the University. An appointment to it is the appointing '
      'authority''s to make — the Vice-Chancellor or the Chancellor — and cannot be initiated '
      'by the % office.', coalesce(post, 'That post'), coalesce(new.initiated_by_office, 'unnamed')
      using errcode = 'check_violation';
  end if;

  return new;
end $$;

drop trigger if exists appointments_executive_posts_are_reserved on appointments;
create trigger appointments_executive_posts_are_reserved
  before insert or update on appointments
  for each row execute function refuse_executive_appointment_from_below();


-- ===========================================================================
-- 6. THE SWITCH, AS GRANTS RATHER THAN A SETTING
-- ===========================================================================
--
-- The University asked for a switch the Superadministrator can use to approve
-- or deny access. This is that, built as grants, and the difference is worth
-- stating because it is the whole reason for the table.
--
-- A SETTING ANSWERS "CAN THEY?" A GRANT ANSWERS "COULD THEY, THEN?"
--
-- A switch that turns "hr-officer may see the whole register" on and off holds
-- one bit, and that bit is always the CURRENT value. Six months after a letter
-- was written, with the switch off, there is nothing in the database that says
-- whether it was on the day the letter was written. The record cannot answer
-- the only question anybody ever asks about a permission — who could do this,
-- and when.
--
-- A grant is a row with two dates on it. Turning it off does not erase it.
--
-- THREE RULES, EACH REFUSING SOMETHING:
--
--   EVERY GRANT EXPIRES. There is no open-ended grant, because an open-ended
--   grant is a role change written in the wrong table, and it will be
--   forgotten — that is not a risk, it is what happens.
--
--   EVERY GRANT SAYS WHY. Not a full stop: twenty characters, the same floor
--   053 put on `standing`.
--
--   A GRANT IS NOT EDITABLE. It may be revoked, which is a new fact with its
--   own timestamp. It may not be rewritten, because a permission whose reason
--   and dates can be changed afterwards proves nothing about the past.

create table if not exists capability_grants (
  id           uuid primary key default gen_random_uuid(),
  -- WHO. A person, not a role. Granting to a role is what the role matrix is
  -- for; this table exists for the exception to it.
  grantee_id   uuid not null references auth.users (id) on delete cascade,
  -- WHAT. Deliberately unconstrained text. The vocabulary lives in
  -- src/lib/roles.ts and moves with the application; a CHECK listing the
  -- capabilities here would be a second copy that goes stale, and a stale
  -- vocabulary refuses a capability the application has just added.
  -- /api/admin/capability-grant validates against the real list.
  capability   text not null check (length(btrim(capability)) between 3 and 80),
  reason       text not null check (length(btrim(reason)) >= 20),
  granted_by   uuid not null references auth.users (id) on delete restrict,
  granted_at   timestamptz not null default now(),
  expires_at   timestamptz not null,
  revoked_at   timestamptz,
  revoked_by   uuid references auth.users (id) on delete set null,

  constraint capability_grants_expires_after_granting
    check (expires_at > granted_at),
  -- A REVOCATION HAS A REVOKER, and a revoker implies a revocation. Half of
  -- either is a row nobody can read.
  constraint capability_grants_revocation_is_whole
    check ((revoked_at is null) = (revoked_by is null))
);

create index if not exists capability_grants_grantee
  on capability_grants (grantee_id, capability);

comment on table capability_grants is
  'The Superadministrator''s switch, as rows. A named person holds a named capability until a '
  'stated date for a stated reason. Every grant expires, every grant says why, and no grant '
  'can be rewritten once made — only revoked, which is a new fact with its own timestamp.';

-- ---------------------------------------------------------------------------
-- NOT EDITABLE, AND THIS IS THE PART THAT MAKES THE TABLE WORTH HAVING
-- ---------------------------------------------------------------------------

create or replace function refuse_to_rewrite_a_grant()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    raise exception
      'A grant is not deleted. Revoke it: the row is the record that somebody held this, and '
      'for how long.'
      using errcode = 'check_violation';
  end if;

  if new.grantee_id is distinct from old.grantee_id
     or new.capability is distinct from old.capability
     or new.reason    is distinct from old.reason
     or new.granted_by is distinct from old.granted_by
     or new.granted_at is distinct from old.granted_at
     or new.expires_at is distinct from old.expires_at then
    raise exception
      'A grant cannot be rewritten. Revoke this one and make another — a permission whose '
      'reason and dates can be changed afterwards proves nothing about the past.'
      using errcode = 'check_violation';
  end if;

  -- AND A REVOCATION IS NOT UNDONE EITHER. Restoring access is a new grant.
  if old.revoked_at is not null and new.revoked_at is null then
    raise exception
      'This grant was revoked. That is part of the record. Make a new grant instead.'
      using errcode = 'check_violation';
  end if;

  return new;
end $$;

drop trigger if exists capability_grants_are_not_rewritten on capability_grants;
create trigger capability_grants_are_not_rewritten
  before update or delete on capability_grants
  for each row execute function refuse_to_rewrite_a_grant();

-- ---------------------------------------------------------------------------
-- WHAT IS IN FORCE RIGHT NOW. The application reads this, never the table, so
-- that "expired" and "revoked" are decided in one place rather than in every
-- caller that forgets one of them.
-- ---------------------------------------------------------------------------

create or replace view capability_grants_in_force
with (security_invoker = true) as
select id, grantee_id, capability, reason, granted_by, granted_at, expires_at
  from capability_grants
 where revoked_at is null
   and expires_at > now();

comment on view capability_grants_in_force is
  'Grants that have not expired and have not been revoked. Read this, not the table: it is the '
  'one place where "still in force" is decided.';

alter table capability_grants enable row level security;

-- YOU SEE YOUR OWN GRANTS. Somebody should be able to find out what they have
-- been given and when it runs out, without asking the Superadministrator.
drop policy if exists capability_grants_own on capability_grants;
create policy capability_grants_own on capability_grants
  for select using (
    grantee_id = auth.uid()
    or auth_role() in ('superadmin', 'admin')
  );

-- No write policy. Grants are made through /api/admin/capability-grant, which
-- checks that the caller is the Superadministrator and records who granted it.


-- ===========================================================================
-- 7. PROVE IT
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- HOW AN ACTOR IS PUT ON IN THESE PROOFS, because getting this wrong makes
-- every assertion below pass without testing anything.
--
-- `auth_role()` does NOT read the JWT. A later migration redefined it as
--
--     select role from public.profiles where id = auth.uid();
--
-- so setting `request.jwt.claim.role` changes nothing — it is read by no
-- function in this database. The first draft of this proof did exactly that,
-- and the student and visitor assertions both "passed" because auth_role()
-- was returning NULL for everybody and the policy refused every row. Only the
-- Registrar assertion — the one that expects to SEE something — noticed.
--
-- SO EVERY CHECK THAT EXPECTS A REFUSAL IS PAIRED WITH ONE THAT EXPECTS A
-- ROW. A proof made only of refusals cannot tell a working rule from a broken
-- connection.
--
-- Identity is `request.jwt.claim.sub`, and the role is whatever `profiles`
-- says for that id.
-- ---------------------------------------------------------------------------

do $$
declare
  vc        uuid;
  hr        uuid;
  other_hr  uuid;
  reg       uuid;
  stu       uuid;
  a_mine    uuid;
  a_theirs  uuid;
  exec_post uuid;
  g_id      uuid;
  seen      integer;
  refused   boolean;
begin
  begin
    vc       := gen_random_uuid();
    hr       := gen_random_uuid();
    other_hr := gen_random_uuid();
    reg      := gen_random_uuid();
    stu      := gen_random_uuid();
    insert into auth.users (id, email) values
      (vc,       '056-vc@example.test'),
      (hr,       '056-hr@example.test'),
      (other_hr, '056-hr2@example.test'),
      (reg,      '056-registrar@example.test'),
      (stu,      '056-student@example.test');
    insert into profiles (id, email, role) values
      (vc,       '056-vc@example.test',        'vice-chancellor'),
      (hr,       '056-hr@example.test',        'hr-officer'),
      (other_hr, '056-hr2@example.test',       'hr-officer'),
      (reg,      '056-registrar@example.test', 'registrar'),
      (stu,      '056-student@example.test',   'student')
    on conflict (id) do update set role = excluded.role;

    -- ---- THE BLANK CERTIFICATE IS NOT PUBLIC ------------------------------
    insert into credential_templates (kind, version, name, design, is_active)
      values ('certificate', 990056, '056 proof', '{}'::jsonb, false);

    set local role authenticated;

    execute format('set local request.jwt.claim.sub = %L', stu);
    select count(*) into seen from credential_templates where version = 990056;
    if seen <> 0 then
      raise exception '056 FAILED: a student can read the blank certificate';
    end if;

    -- THE VISITOR WHO NEVER SIGNED IN. This is the caller `using (true)` was
    -- serving, and the one worth naming separately: not a member of staff with
    -- too much access, but the public.
    set local request.jwt.claim.sub = '';
    select count(*) into seen from credential_templates where version = 990056;
    if seen <> 0 then
      raise exception '056 FAILED: a visitor who is not signed in can read the blank certificate';
    end if;

    -- AND THE OFFICE THAT ISSUES FROM IT STILL CAN. A rule that also refuses
    -- the people who need the row is not a tighter rule, it is a broken screen.
    -- This assertion is what caught the proof above testing nothing at all.
    execute format('set local request.jwt.claim.sub = %L', reg);
    select count(*) into seen from credential_templates where version = 990056;
    if seen <> 1 then
      raise exception '056 FAILED: the Registrar cannot read the blank certificate';
    end if;

    reset role;

    -- ---- THE THREE BANDS --------------------------------------------------
    insert into appointments (full_name, position_title, employment_type, start_date,
                              place_of_duty, status, drafted_by, initiated_by_office)
      values ('056 Mine', 'A Proof Post', 'permanent', '2026-10-01', 'Buea', 'draft', hr, 'hr')
      returning id into a_mine;

    insert into appointments (full_name, position_title, employment_type, start_date,
                              place_of_duty, status, drafted_by, initiated_by_office)
      values ('056 Theirs', 'A Proof Post', 'permanent', '2026-10-01', 'Buea', 'draft',
              other_hr, 'hr')
      returning id into a_theirs;

    set local role authenticated;
    execute format('set local request.jwt.claim.sub = %L', hr);

    -- ON YOUR DESK. This is the band 041 did not have, and without it the HR
    -- screen is an empty table for the officer who drafted every row in it.
    select count(*) into seen from appointments where id = a_mine;
    if seen <> 1 then
      raise exception '056 FAILED: an HR officer cannot see the appointment they drafted';
    end if;

    -- AND NOT SOMEBODY ELSE'S.
    select count(*) into seen from appointments where id = a_theirs;
    if seen <> 0 then
      raise exception '056 FAILED: an HR officer can read an appointment off another desk';
    end if;

    -- AND NOT A STUDENT'S BUSINESS AT ALL.
    execute format('set local request.jwt.claim.sub = %L', stu);
    select count(*) into seen from appointments where id in (a_mine, a_theirs);
    if seen <> 0 then
      raise exception '056 FAILED: a student can read the appointment register';
    end if;

    -- THE REGISTER. The University has ruled the Registrar sees all of it.
    execute format('set local request.jwt.claim.sub = %L', reg);
    select count(*) into seen from appointments where id in (a_mine, a_theirs);
    if seen <> 2 then
      raise exception '056 FAILED: the Registrar cannot see the whole register';
    end if;

    -- AND THE VICE-CHANCELLOR, who since 055 may draft and approve alone and
    -- under 041's policy could not then see what they had made.
    execute format('set local request.jwt.claim.sub = %L', vc);
    select count(*) into seen from appointments where id in (a_mine, a_theirs);
    if seen <> 2 then
      raise exception '056 FAILED: the Vice-Chancellor cannot see the register';
    end if;

    reset role;

    -- ---- AN EXECUTIVE POST IS RESERVED ------------------------------------
    insert into positions (job_code, title, family, executive_level)
      values ('PROOF-EXEC-056', 'A Proof Executive Office', 'other', 'Executive')
      returning id into exec_post;

    refused := false;
    begin
      insert into appointments (full_name, position_title, employment_type, start_date,
                                place_of_duty, status, drafted_by, initiated_by_office,
                                position_id)
        values ('056 Exec', 'A Proof Executive Office', 'permanent', '2026-10-01', 'Buea',
                'draft', hr, 'hr', exec_post);
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '056 FAILED: HR filled an executive post';
    end if;

    -- AND THE APPOINTING AUTHORITY MAY.
    insert into appointments (full_name, position_title, employment_type, start_date,
                              place_of_duty, status, drafted_by, initiated_by_office,
                              position_id)
      values ('056 Exec', 'A Proof Executive Office', 'permanent', '2026-10-01', 'Buea',
              'draft', vc, 'vice-chancellor', exec_post);

    -- AND AN ORDINARY POST IS UNTOUCHED. A rule that quietly stops HR doing
    -- its ordinary work would be discovered as an outage, not as a rule.
    insert into positions (job_code, title, family)
      values ('PROOF-ORD-056', 'A Proof Ordinary Post', 'other')
      returning id into exec_post;
    insert into appointments (full_name, position_title, employment_type, start_date,
                              place_of_duty, status, drafted_by, initiated_by_office,
                              position_id)
      values ('056 Ordinary', 'A Proof Ordinary Post', 'permanent', '2026-10-01', 'Buea',
              'draft', hr, 'hr', exec_post);

    -- ---- THE GRANTS -------------------------------------------------------
    insert into capability_grants (grantee_id, capability, reason, granted_by, expires_at)
      values (hr, 'authorize-appointment',
              'Covering the Registrar during the September recess.', vc, now() + interval '14 days')
      returning id into g_id;

    -- NO OPEN-ENDED GRANT.
    refused := false;
    begin
      insert into capability_grants (grantee_id, capability, reason, granted_by, expires_at)
        values (hr, 'issue-credential', 'A perfectly good reason, at length.', vc, null);
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '056 FAILED: a grant was made with no expiry';
    end if;

    -- NO GRANT WITHOUT A REASON. A full stop is what a mandatory box gets.
    refused := false;
    begin
      insert into capability_grants (grantee_id, capability, reason, granted_by, expires_at)
        values (hr, 'issue-credential', '.', vc, now() + interval '1 day');
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '056 FAILED: a grant was made without a stated reason';
    end if;

    -- NOT REWRITEABLE.
    refused := false;
    begin
      update capability_grants set expires_at = now() + interval '400 days' where id = g_id;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '056 FAILED: a grant was rewritten after the fact';
    end if;

    -- NOT DELETABLE.
    refused := false;
    begin
      delete from capability_grants where id = g_id;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '056 FAILED: a grant was deleted';
    end if;

    -- REVOCABLE, AND THEN GONE FROM WHAT IS IN FORCE.
    if not exists (select 1 from capability_grants_in_force where id = g_id) then
      raise exception '056 FAILED: a live grant is not in force';
    end if;

    update capability_grants set revoked_at = now(), revoked_by = vc where id = g_id;

    if exists (select 1 from capability_grants_in_force where id = g_id) then
      raise exception '056 FAILED: a revoked grant is still in force';
    end if;

    -- AND THE REVOCATION DOES NOT COME OFF.
    refused := false;
    begin
      update capability_grants set revoked_at = null, revoked_by = null where id = g_id;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '056 FAILED: a revocation was undone';
    end if;

    -- AN EXPIRED GRANT IS NOT IN FORCE EITHER, and this is the one people
    -- forget: it was never revoked, so a caller checking `revoked_at is null`
    -- alone would still honour it.
    insert into capability_grants (grantee_id, capability, reason, granted_by,
                                   granted_at, expires_at)
      values (hr, 'issue-credential', 'An old grant that has since run out.', vc,
              now() - interval '30 days', now() - interval '1 day')
      returning id into g_id;

    if exists (select 1 from capability_grants_in_force where id = g_id) then
      raise exception '056 FAILED: an expired grant is still in force';
    end if;

    raise exception 'PROOF_ROLLBACK';
  exception
    when others then
      reset role;
      if sqlerrm <> 'PROOF_ROLLBACK' then raise; end if;
  end;

  raise notice '056 OK: the blank certificate and transcript are readable only by the offices '
               'that design, approve or issue from them — not by students, and not by visitors';
  raise notice '056 OK: the appointment register has three bands — yours, on your desk, and the '
               'whole register for the Registrar, the Vice-Chancellor and the Chancellor';
  raise notice '056 OK: an executive post can only be filled by the appointing authority';
  raise notice '056 OK: a grant expires, states a reason, cannot be rewritten or deleted, and '
               'is out of force once revoked or expired';
end $$;


-- ===========================================================================
-- 8. VERIFY — READ THIS OUTPUT
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- WHO CAN READ THE BLANK DOCUMENTS NOW. Before this file the answer was
-- `true`, meaning everybody. It should now name five offices.
-- ---------------------------------------------------------------------------
select 'credential_templates' as protects,
       pg_get_expr(polqual, polrelid) as readable_by
  from pg_policy
 where polname = 'credential_templates_read';

-- ---------------------------------------------------------------------------
-- AND THE GRANTS IN FORCE. Empty today. Anything here is somebody holding a
-- capability their role does not carry, and the row says who gave it, why,
-- and when it lapses.
-- ---------------------------------------------------------------------------
select count(*) filter (where true)                     as grants_ever,
       count(*) filter (where revoked_at is not null)   as revoked,
       count(*) filter (where expires_at <= now())      as expired,
       (select count(*) from capability_grants_in_force) as in_force
  from capability_grants;
