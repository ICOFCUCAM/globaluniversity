-- ===========================================================================
-- 110 — A TRANSFER CREDIT IS A CREDIT, AND IT IS NEVER AN ICOF CREDIT
-- ===========================================================================
--
-- The University's decision of 16 September 2026:
--
--   "Credit transfer: YES. ICOF accepts transfer credits from other
--    institutions, and `transfer_credits` becomes a real workflow rather than
--    being retired. Approved credits join the authoritative academic record
--    and must reach programme progress, credit totals, graduation eligibility
--    and the transcript. THEY STAY DISTINGUISHABLE FROM COURSES COMPLETED AT
--    ICOF — that distinction is the point, not a detail."
--
-- ---------------------------------------------------------------------------
-- WHAT WAS THERE
-- ---------------------------------------------------------------------------
--
-- 019 built the table and nothing else. A row, an `accepted` boolean, and row
-- policies. No path from claimed to decided, no screen, no route — and, which
-- matters more, NO CONNECTION TO ANYTHING. `student_academic_record` is the
-- one authoritative record in this system, and its `credits_earned` counts
-- `student_curriculum_progress` and nothing besides. A student could hold
-- thirty accepted transfer credits and the record that decides whether they
-- graduate would not know.
--
-- So the University could accept a credit and the system would still refuse
-- the degree. That is the gap this closes.
--
-- ---------------------------------------------------------------------------
-- WHAT CHANGES FOR THE UNIVERSITY THE MOMENT THIS RUNS
-- ---------------------------------------------------------------------------
--
-- 1. ANY STUDENT ALREADY HOLDING AN ACCEPTED TRANSFER CREDIT MOVES CLOSER TO
--    THEIR AWARD, AT ONCE. `credits_against_award` is the distance from the
--    degree and it now counts transferred credit. That is the change the
--    University asked for and it is a change to a number screens already
--    show: the graduation candidate list, the progress sheet, the student's
--    own dashboard. If a credit was accepted in error, it was already wrong;
--    this is the migration that makes it visible.
--
--    EVERY ROW 019 ALREADY HOLDS IS FILED AS DECIDED OR AS WAITING, from its
--    own `accepted` flag, and none is invented or discarded.
--
-- 2. THE GPA DOES NOT MOVE, FOR ANYBODY. See §4. A transfer credit counts
--    toward the award and is never scored.
--
-- 3. NOTHING IS ACCEPTED BY THIS MIGRATION. It builds the path; every
--    decision on it is somebody's, afterwards.
--
-- ---------------------------------------------------------------------------
-- AND ONE THING THE UNIVERSITY HAS NOT RULED ON
-- ---------------------------------------------------------------------------
--
-- HOW MUCH OF A DEGREE MAY BE SOMEBODY ELSE'S TEACHING. Most institutions cap
-- it — half the award, two thirds, a residency requirement in the final year.
-- ICOF has said nothing, and a cap is an institutional fact, so this migration
-- does not invent one and does not enforce one.
--
-- It counts, instead. `transfers_that_carry_most_of_the_award` lists every
-- student whose transferred credit is half their award or more, so the
-- University can settle the question with the cases in front of them. That is
-- the same thing 102 does with the two refund rules that disagree.
-- ===========================================================================


-- ===========================================================================
-- 1. THE PATH
-- ===========================================================================
--
-- 019 had a boolean. A boolean cannot say "the Registry has recorded what the
-- student presented and nobody has looked at it yet", which is the state
-- almost every one of these is in for most of its life.
--
--   submitted  → under_review → accepted
--                             → refused
--   submitted  → withdrawn                 (the student took it back)
--   accepted   → rescinded                 (and only ever for a stated reason)
--
-- RESCINDED EXISTS AND `accepted` IS NOT TERMINAL, deliberately. An accepted
-- credit reaches the authoritative record and the sealed transcript; when a
-- transcript from elsewhere turns out to be false, the University must be able
-- to take it back, and the alternative to a recorded rescission is somebody
-- editing the row quietly. A rescinded credit stops counting and stays on the
-- file saying what happened.
-- ---------------------------------------------------------------------------

alter table transfer_credits
  add column if not exists status             text,
  add column if not exists submitted_by       uuid references auth.users (id) on delete set null,
  add column if not exists submitted_at       timestamptz,
  add column if not exists reviewed_by        uuid references auth.users (id) on delete set null,
  add column if not exists reviewed_at        timestamptz,
  add column if not exists decision_reason    text,
  -- WHAT IT STANDS FOR, where it stands for something in particular. A credit
  -- mapped to a course of the curriculum shows up on the progress sheet
  -- against that course; an unmapped one is general credit toward the award.
  -- Both count; only the first can fill a hole in the curriculum.
  add column if not exists equivalent_course_id uuid references courses (id) on delete set null,
  -- THE OTHER INSTITUTION'S GRADE, RECORDED AND NEVER SCORED. See §4.
  add column if not exists source_grade       text;

-- ---------------------------------------------------------------------------
-- THE BACKFILL, AND WHY IT IS NOT A DEFAULT.
--
-- A new column with `default 'submitted'` would file every row 019 already
-- holds as freshly claimed — including ones the University has ACCEPTED,
-- which would un-decide a decision somebody took. So the column arrives
-- nullable, is filled from the flag that has been carrying this meaning all
-- along, and only then becomes NOT NULL.
--
-- `accepted = false` is read as `submitted` rather than as refused: 019's
-- boolean cannot tell a refusal from an undecided claim, and recording a
-- refusal the University never made would be worse than asking them to look.
-- ---------------------------------------------------------------------------
update transfer_credits
   set status = case when accepted then 'accepted' else 'submitted' end
 where status is null;

update transfer_credits
   set submitted_at = coalesce(submitted_at, created_at)
 where submitted_at is null;

alter table transfer_credits
  alter column status set default 'submitted',
  alter column status set not null,
  alter column submitted_at set default now();

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'transfer_credits_status_check') then
    alter table transfer_credits add constraint transfer_credits_status_check
      check (status in ('submitted', 'under_review', 'accepted', 'refused',
                        'withdrawn', 'rescinded'));
  end if;

  -- A REFUSAL AND A RESCISSION BOTH HAVE TO SAY WHY. A decision with no
  -- reason is a decision nobody can be asked about, and these are the two the
  -- student will ask about.
  if not exists (select 1 from pg_constraint where conname = 'transfer_credits_reason_check') then
    alter table transfer_credits add constraint transfer_credits_reason_check
      check (status not in ('refused', 'rescinded')
             or (decision_reason is not null and length(btrim(decision_reason)) >= 10));
  end if;

  -- AND NO MORE MAY BE ACCEPTED THAN WAS OFFERED. Accepting forty credits for
  -- a thirty-credit course is not a generous reading of another institution's
  -- transcript; it is a number nobody can source.
  if not exists (select 1 from pg_constraint where conname = 'transfer_credits_not_more_check') then
    alter table transfer_credits add constraint transfer_credits_not_more_check
      check (credits_accepted is null or credits_accepted <= credits);
  end if;
end $$;

comment on column transfer_credits.status is
  'Where the claim has got to: submitted, under_review, accepted, refused, withdrawn, '
  'rescinded. 019 had a boolean, which could not tell an undecided claim from a refused one — '
  'so every row it already held is filed as accepted or as submitted, and nothing is recorded '
  'as a refusal the University never made.';

comment on column transfer_credits.equivalent_course_id is
  'The course of the curriculum this credit stands for, where it stands for one. Mapped, it '
  'fills that hole on the progress sheet; unmapped, it is general credit toward the award. '
  'Both count toward the total.';

comment on column transfer_credits.source_grade is
  'The grade the other institution awarded, recorded for the file and NEVER scored. See the '
  'note on `a_transfer_credit_is_never_scored` — ICOF''s CGPA is a measure of ICOF''s teaching.';


-- ---------------------------------------------------------------------------
-- `accepted` IS KEPT IN STEP, because 019 made it the thing a CHECK
-- constraint and every existing reader depend on, and two columns that can
-- disagree about whether a credit counts is the worst outcome available here.
--
-- A TRIGGER RATHER THAN A GENERATED COLUMN: making `accepted` generated means
-- dropping and re-adding it, which would destroy whatever the University has
-- in it on a table this migration has no right to empty.
-- ---------------------------------------------------------------------------

create or replace function a_transfer_credit_follows_its_path()
returns trigger
language plpgsql
as $$
declare
  allowed text[];
begin
  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    allowed := case old.status
      when 'submitted'    then array['under_review', 'refused', 'withdrawn']
      when 'under_review' then array['accepted', 'refused', 'withdrawn', 'submitted']
      when 'accepted'     then array['rescinded']
      -- THE THREE THAT ARE THE END OF IT. A refused claim is argued again by
      -- presenting it again, which is a new row with its own history, not an
      -- old row quietly reopened.
      else array[]::text[]
    end;

    if not (new.status = any (allowed)) then
      raise exception 'A transfer credit cannot go from % to %. From % it can only go to %.',
        old.status, new.status, old.status,
        case when array_length(allowed, 1) is null then 'nowhere — that is the end of it'
             else array_to_string(allowed, ', ') end;
    end if;
  end if;

  -- THE FLAG FOLLOWS THE STATUS, never the other way round.
  new.accepted := (new.status = 'accepted');

  if new.status = 'accepted' then
    new.decided_on := coalesce(new.decided_on, current_date);
    -- WHAT WAS ACCEPTED, WHERE NOBODY SAID. Taken as the whole of what was
    -- offered, which is what accepting a credit without qualification means.
    new.credits_accepted := coalesce(new.credits_accepted, new.credits);
  end if;

  if new.status in ('refused', 'rescinded', 'withdrawn') then
    -- IT STOPS COUNTING. Leaving the number behind on a row that no longer
    -- counts is how a total comes to disagree with the list under it.
    new.credits_accepted := null;
    new.accepted := false;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists a_transfer_credit_follows_its_path_trg on transfer_credits;
create trigger a_transfer_credit_follows_its_path_trg
  before insert or update on transfer_credits
  for each row execute function a_transfer_credit_follows_its_path();

comment on function a_transfer_credit_follows_its_path() is
  'The path a claimed transfer credit may take, enforced in the database rather than in a '
  'route — because 019''s table is writable by four offices and a rule that lives in one '
  'screen is a rule the other three do not have. Also keeps 019''s `accepted` flag in step '
  'with `status`, so the two can never disagree about whether a credit counts.';


-- ===========================================================================
-- 2. WHO MAY DO WHICH HALF
-- ===========================================================================
--
-- TWO ACTS AND NOT ONE. Recording what a student presented is clerical: the
-- Registry reads another institution's transcript and types what it says.
-- Deciding that it stands against an ICOF award is an academic judgement about
-- somebody else's teaching.
--
-- THIS NARROWS WHAT 019 ALLOWED, AND IT IS SAID OUT LOUD BECAUSE OF THAT.
-- Under 019 the Registrar could set `accepted` directly. They now record,
-- administer and withdraw, and the academic decision sits with the offices
-- that hold `approve-transfers` — the Faculty Dean and the Academic Office.
-- If the University would rather the Registrar kept the decision, it is one
-- line in `src/lib/roles.ts` and this comment is wrong rather than the system.
-- ---------------------------------------------------------------------------

create or replace function may_decide_a_transfer_credit()
returns boolean
language sql
stable
as $$
  select coalesce(auth_role(), '') in ('superadmin', 'admin', 'dean', 'academic-office')
$$;

comment on function may_decide_a_transfer_credit() is
  'Who may accept, refuse or rescind a transfer credit: the offices that hold '
  '`approve-transfers`. Recording one is the Registry''s and is governed by 019''s write '
  'policy, which is unchanged.';

drop policy if exists transfer_credits_update on transfer_credits;
create policy transfer_credits_update on transfer_credits
  for update using (
    auth_role() in ('superadmin', 'admin', 'registrar', 'academic-office', 'dean')
  );

comment on policy transfer_credits_update on transfer_credits is
  'The offices that may touch a claim at all. WHICH CHANGE each may make is the route''s and '
  'the path trigger''s business, not this policy''s: a policy can say who writes to the table '
  'and cannot say that the Registrar may withdraw a claim and not accept one.';


-- ===========================================================================
-- 3. IT REACHES THE AUTHORITATIVE RECORD
-- ===========================================================================
--
-- The whole point of the University's decision, and the thing 019 left out.
--
-- THREE NUMBERS, NEVER ONE. `credits_earned` keeps meaning exactly what it
-- has always meant — credit for courses passed AT ICOF — and is not touched.
-- `credits_transferred` is the other institution's. `credits_total` is what
-- counts toward the award. Collapsing them into a single figure would answer
-- the University's requirement and lose the distinction they said was the
-- point of it.
--
-- `credits_against_award` NOW COUNTS BOTH, which is the behaviour change. It
-- is the distance from the degree, and a student holding accepted transfer
-- credit really is closer than it has been saying.
--
-- ---------------------------------------------------------------------------
-- WHY THIS VIEW IS DROPPED AND REBUILT RATHER THAN REPLACED
-- ---------------------------------------------------------------------------
--
-- `create or replace view` can append a column and can change nothing else —
-- not a name, not an order, and NOT A TYPE. `credits_against_award` is
-- `bigint`, because every figure it is made of is an integer; adding
-- transferred credit makes it `numeric`, because 019 allowed a fractional
-- credit from another institution and rounding somebody's three-and-a-half
-- credits to four is the system inventing half a credit.
--
--   ERROR: cannot change data type of view column "credits_against_award"
--          from bigint to numeric
--
-- So it has to be dropped, and two views read it: `graduation_candidate`
-- (069) and `my_journey` (070). THEY ARE NOT TRANSCRIBED HERE. A hundred and
-- sixty lines of somebody else's view copied into this file is a hundred and
-- sixty chances to change one, and the two screens that would break are the
-- graduation list and the student's own dashboard.
--
-- Instead their definitions are READ OUT OF THE CATALOGUE before the drop and
-- replayed afterwards, with their comments and their grants. That is exact by
-- construction, and it keeps working if the University adds a third.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- ONE STATEMENT, START TO FINISH, AND THAT IS THE POINT OF IT
-- ---------------------------------------------------------------------------
--
-- This was three statements with a table between them, and the University's
-- SQL editor refused the bundle on it:
--
--   ERROR: 42P01: relation "migration_110_replay" does not exist
--
-- …reading a table two statements after creating it. It works under psql, in
-- autocommit and in one transaction alike; it did not work there. Rather than
-- keep guessing at what the editor does between statements — whether it
-- splits them, pools them, or hands each to a different backend — THE
-- MIGRATION NOW ASKS FOR NOTHING TO SURVIVE BETWEEN THEM.
--
-- Capture, drop, rebuild and replay all happen inside this single DO block.
-- Nothing is created to hold the captured definitions: they live in a jsonb
-- value in a local variable for the few milliseconds between the drop and the
-- rebuild. There is no table to be missing and no session setting to be lost,
-- which is the only way to be sure.
--
-- THE COST IS THAT THE VIEW IS A STRING. `execute $view$ … $view$` is harder
-- to read than a plain `create view`, and it is the whole of the price. The
-- definition below is unchanged from the one this file has always had.
-- ---------------------------------------------------------------------------

do $rebuild$
declare
  captured jsonb;
  r        jsonb;
  g        text;
  grantee  text;
  privs    text;
  letters  text[];
  n        integer := 0;
  lost     integer := 0;
begin
  -- ---- WHAT READS THE RECORD TODAY -------------------------------------
  --
  -- Recursively, because one of them may be read by another. Their
  -- definitions, comments, `security_invoker` setting and grants, exactly as
  -- the catalogue has them — not transcribed, because 110 does not own
  -- `graduation_candidate` or `my_journey` and copying somebody else's view
  -- is how it comes to differ from itself.
  with recursive dependents as (
    select c.oid, 0 as depth
      from pg_class c
     where c.relname = 'student_academic_record' and c.relkind = 'v'
    union
    select v.oid, d.depth + 1
      from dependents d
      join pg_depend dep on dep.refobjid = d.oid
      join pg_rewrite rw on rw.oid = dep.objid
      join pg_class v on v.oid = rw.ev_class and v.relkind = 'v'
     where v.oid <> d.oid
  )
  select coalesce(jsonb_agg(to_jsonb(z) order by z.depth, z.name), '[]'::jsonb)
    into captured
    from (
      select c.relname::text                    as name,
             max(d.depth)                       as depth,
             pg_get_viewdef(c.oid, true)        as definition,
             obj_description(c.oid, 'pg_class') as note,
             coalesce((select option_value from pg_options_to_table(c.reloptions)
                        where option_name = 'security_invoker'), 'false') as invoker,
             (select coalesce(array_agg(a::text), array[]::text[])
                from unnest(coalesce(c.relacl, array[]::aclitem[])) a) as acl
        from dependents d
        join pg_class c on c.oid = d.oid
       where c.relname <> 'student_academic_record'
       group by c.oid, c.relname, c.reloptions, c.relacl
    ) z;

  raise notice '110 --  % view(s) read student_academic_record and will be rebuilt exactly '
               'as the catalogue has them', jsonb_array_length(captured);

  -- ---- OUT, AND BACK IN THE NEW SHAPE -----------------------------------
  execute 'drop view if exists student_academic_record cascade';

  execute $view$
create view student_academic_record
with (security_invoker = true) as
select s.id                                        as student_id,
       s.matric_no,
       s.student_number,
       nullif(btrim(concat_ws(' ', s.first_name, s.middle_name, s.last_name)), '')
                                                   as full_name,
       s.status,
       s.student_status,
       s.academic_standing,
       s.admission_year,
       s.programme_version_id,
       p.code                                      as programme_code,
       v.name                                      as programme_name,
       v.version_label,
       v.duration_years,
       v.semesters_per_year,
       v.total_credits                             as credits_required,
       coalesce(prog.passed, 0)                    as courses_passed,
       coalesce(prog.failed, 0)                    as courses_failed,
       coalesce(prog.registered, 0)                as courses_registered,
       coalesce(prog.not_taken, 0)                 as courses_outstanding,
       -- UNCHANGED, AND DELIBERATELY SO: credit for courses passed at ICOF.
       coalesce(prog.credits_earned, 0)            as credits_earned,
       coalesce(prog.credits_registered, 0)        as credits_registered,
       -- 110: THE DISTANCE FROM THE AWARD NOW COUNTS TRANSFERRED CREDIT.
       case when v.total_credits is null then null
            else coalesce(prog.credits_earned, 0) + coalesce(tc.credits_transferred, 0)
                 - v.total_credits
       end                                         as credits_against_award,
       g.cgpa,
       g.gpa                                       as last_semester_gpa,
       g.academic_year                             as last_computed_year,
       g.semester                                  as last_computed_semester,
       -- ---- APPENDED BY 110 ----------------------------------------------
       coalesce(tc.credits_transferred, 0)         as credits_transferred,
       coalesce(tc.transfers_accepted, 0)          as transfers_accepted,
       coalesce(prog.credits_earned, 0) + coalesce(tc.credits_transferred, 0)
                                                   as credits_total
  from students s
  left join programme_versions v on v.id = s.programme_version_id
  left join programmes p on p.id = v.programme_id
  left join lateral (
    select count(*) filter (where pr.state = 'passed')                     as passed,
           count(*) filter (where pr.state = 'failed')                     as failed,
           count(*) filter (where pr.state = 'registered')                 as registered,
           count(*) filter (where pr.state = 'not-taken')                  as not_taken,
           coalesce(sum(pr.credits) filter (where pr.state = 'passed'), 0) as credits_earned,
           coalesce(sum(pr.credits) filter (where pr.state = 'registered'), 0)
                                                                          as credits_registered
      from student_curriculum_progress pr
     where pr.student_id = s.id
  ) prog on true
  -- SUMMED FROM THE CLAIMS THEMSELVES, not from the progress sheet, and that
  -- is not a detail: the progress sheet can only show a transfer credit that
  -- was MAPPED to a course of the curriculum, and an unmapped one is still
  -- credit toward the award. Counting the sheet would silently drop them.
  left join lateral (
    select coalesce(sum(t.credits_accepted), 0) as credits_transferred,
           count(*)                             as transfers_accepted
      from transfer_credits t
     where t.student_id = s.id and t.status = 'accepted'
  ) tc on true
  left join lateral (
    select sg.cgpa, sg.gpa, sg.academic_year, sg.semester
      from semester_gpas sg
     where sg.student_id = s.id
     order by sg.academic_year desc, sg.semester desc
     limit 1
  ) g on true
$view$;

  -- ---- AND WHATEVER WAS READING IT GOES BACK ----------------------------
  for r in select value from jsonb_array_elements(captured) loop
    -- A DEPENDENT THAT CANNOT BE REBUILT IS A LATER MIGRATION'S, AND IS SAID
    -- OUT LOUD RATHER THAN LOST QUIETLY. Killing a bundle over a view that is
    -- about to be rebuilt a few thousand lines later would be this block
    -- causing the outage it exists to prevent.
    begin
      execute format('create view %I with (security_invoker = %s) as %s',
                     r->>'name', r->>'invoker', r->>'definition');
      if r->>'note' is not null then
        execute format('comment on view %I is %L', r->>'name', r->>'note');
      end if;
    exception when others then
      raise notice '110 --  could not rebuild view "%" (%). It belongs to a later migration '
                   'and will be restored when that one runs. If you are running this file on '
                   'its own rather than as part of a bundle, RUN THE BUNDLE.',
                   r->>'name', sqlerrm;
      lost := lost + 1;
      continue;
    end;

    -- THE GRANTS, replayed from the aclitem text the catalogue gave us:
    -- "role=privs/grantor". A rebuilt view silently readable by somebody it
    -- was not is the kind of thing nobody notices for a year.
    foreach g in array coalesce(
      array(select jsonb_array_elements_text(r->'acl')), array[]::text[]
    ) loop
      grantee := split_part(g, '=', 1);
      privs   := split_part(split_part(g, '=', 2), '/', 1);
      letters := array[]::text[];
      if grantee = '' then grantee := 'public'; end if;
      -- `array_append`, NOT `letters || 'select'`. An untyped literal on the
      -- right of `||` is read as an array literal, not an element, and the
      -- whole block dies on «malformed array literal: "select"».
      if position('r' in privs) > 0 then letters := array_append(letters, 'select'); end if;
      if position('a' in privs) > 0 then letters := array_append(letters, 'insert'); end if;
      if position('w' in privs) > 0 then letters := array_append(letters, 'update'); end if;
      if position('d' in privs) > 0 then letters := array_append(letters, 'delete'); end if;
      if position('D' in privs) > 0 then letters := array_append(letters, 'truncate'); end if;
      if position('x' in privs) > 0 then letters := array_append(letters, 'references'); end if;
      if position('t' in privs) > 0 then letters := array_append(letters, 'trigger'); end if;
      if array_length(letters, 1) is not null then
        execute format('grant %s on %I to %I',
                       array_to_string(letters, ', '), r->>'name', grantee);
      end if;
    end loop;
    n := n + 1;
  end loop;

  if lost > 0 then
    raise exception '110 FAILED — % dependent view(s) could not be rebuilt. 110 only ADDS '
                    'columns to the record, so nothing that read it before should have '
                    'become unbuildable; see the notices above.', lost;
  end if;
  raise notice '110 OK  the % view(s) that read the record are back, with their comments '
               'and their grants', n;
end
$rebuild$;

comment on view student_academic_record is
  'One row per student: their programme, how far through the curriculum they are, credits '
  'earned against the award, and the GPA the engine last computed. 110 adds '
  '`credits_transferred` and `credits_total` and makes `credits_against_award` count both — '
  'the University''s decision of 16 September 2026 — while `credits_earned` goes on meaning '
  'credit for courses passed AT ICOF, because keeping the two distinguishable is the point of '
  'the ruling and not a detail of it. `credits_against_award` is null where the programme '
  'states no total, which is not the same as being on target.';

-- AND THEY ANSWER. A view that exists and throws on the first select is a
-- view that is not back, and the screens would find out before anybody here
-- did.
do $$
declare r record; n bigint;
begin
  for r in select c.relname from pg_class c join pg_namespace ns on ns.oid = c.relnamespace
            where ns.nspname = 'public' and c.relkind = 'v'
              and c.relname in ('graduation_candidate', 'my_journey') loop
    execute format('select count(*) from %I', r.relname) into n;
  end loop;
  raise notice '110 OK  …and every one of them answers a query';
end $$;



-- ---------------------------------------------------------------------------
-- AND THE PROGRESS SHEET
--
-- A student whose Greek was accepted from another seminary showed `not-taken`
-- against Greek for ever, and a progress sheet saying somebody still has to
-- take a course the University has already excused them is worse than one
-- that omits it.
--
-- `transferred` RANKS BELOW `passed` AND ABOVE EVERYTHING ELSE. A student who
-- transferred a credit and then sat the course here has passed it; the ICOF
-- result is the one that stands, and the sheet says so.
-- ---------------------------------------------------------------------------

create or replace view student_curriculum_progress
with (security_invoker = true) as
select s.id                                        as student_id,
       s.programme_version_id,
       e.id                                        as entry_id,
       e.course_id,
       c.code                                      as course_code,
       c.title                                     as course_title,
       e.year,
       e.semester,
       e.requirement,
       coalesce(e.credits, c.credit_unit, 0)       as credits,
       r.grade,
       r.grade_point,
       r.attempt,
       en.id                                       as enrollment_id,
       en.academic_year                            as taken_in_year,
       en.semester                                 as taken_in_semester,
       case
         when r.id is not null and r.grade_point > 0 then 'passed'
         when tr.id is not null                      then 'transferred'
         when r.id is not null                       then 'failed'
         when en.id is not null                      then 'registered'
         else 'not-taken'
       end                                         as state,
       -- ---- APPENDED BY 110 ----------------------------------------------
       tr.id                                       as transfer_credit_id,
       tr.institution                              as transferred_from,
       tr.credits_accepted                         as credits_transferred
  from students s
  join curriculum_entries e on e.programme_version_id = s.programme_version_id
  join courses c on c.id = e.course_id
  left join lateral (
    select r2.id, r2.grade, r2.grade_point, r2.attempt
      from results r2
     where r2.student_id = s.id
       and r2.course_id = e.course_id
       and r2.status = 'approved'
     order by coalesce(r2.attempt, 1) desc, r2.approved_at desc nulls last
     limit 1
  ) r on true
  left join lateral (
    select e2.id, e2.academic_year, e2.semester
      from enrollments e2
     where e2.student_id = s.id
       and e2.course_id = e.course_id
       and e2.status = 'registered'
     order by e2.academic_year desc, e2.semester desc
     limit 1
  ) en on true
  left join lateral (
    select t.id, t.institution, t.credits_accepted
      from transfer_credits t
     where t.student_id = s.id
       and t.equivalent_course_id = e.course_id
       and t.status = 'accepted'
     order by t.decided_on desc nulls last
     limit 1
  ) tr on true
 where s.programme_version_id is not null;

comment on view student_curriculum_progress is
  'Every course of the curriculum a student was admitted under, with where they are up to. '
  '110 adds the state `transferred` and says which institution it came from. It ranks BELOW '
  '`passed`: a student who transferred a credit and then sat the course here has passed it, '
  'and the ICOF result is the one that stands. The transferred credit is NOT counted in '
  '`student_academic_record.credits_earned` — that figure is ICOF''s teaching — it is counted '
  'in `credits_transferred`, from the claims themselves, so an unmapped credit is not lost.';


-- ===========================================================================
-- 4. AND IT IS NEVER SCORED
-- ===========================================================================
--
-- A transfer credit counts toward the award and never toward the CGPA. The
-- other institution's grade is recorded on the row and is read by nothing that
-- computes.
--
-- WHY, AND IT IS NOT MERELY CONVENTION. 035 publishes ICOF's grading scale and
-- the GPA engine computes against it; importing another institution's grade
-- points would make ICOF's CGPA a weighted average of two marking standards,
-- one of which the Senate has never seen. A degree classification resting on
-- that is a classification the University cannot defend.
--
-- THE SAFEGUARD IS THAT THERE IS NOTHING TO SAFEGUARD: the engine reads
-- `results`, and a transfer credit is not a result. This block asserts it
-- rather than trusting it, because "nothing reads that" is a sentence that
-- stops being true.
-- ---------------------------------------------------------------------------

do $$
declare
  leaks text;
begin
  select string_agg(p.proname, ', ')
    into leaks
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.prosrc ilike '%transfer_credits%'
     and (p.prosrc ilike '%grade_point%' or p.prosrc ilike '%cgpa%');

  if leaks is not null then
    raise exception '110 FAILED — % reads transfer_credits and computes a grade point', leaks;
  end if;
  raise notice '110 OK  nothing that computes a grade point reads a transfer credit';
end $$;


-- ===========================================================================
-- 5. THE QUESTION THE UNIVERSITY HAS NOT ANSWERED
-- ===========================================================================
--
-- How much of a degree may be another institution's teaching. No cap is
-- invented and none is enforced — it is an institutional fact and the
-- University has not stated one. The cases are listed instead, as 102 lists
-- the refunds where the two rules disagree, so the rule can be settled with
-- them in front of the Senate.
-- ---------------------------------------------------------------------------

drop view if exists transfers_that_carry_most_of_the_award;

create view transfers_that_carry_most_of_the_award
with (security_invoker = true) as
  select r.student_id,
         r.matric_no,
         r.student_number,
         r.full_name,
         r.programme_code,
         r.programme_name,
         r.credits_required,
         r.credits_earned,
         r.credits_transferred,
         r.credits_total,
         round(100.0 * r.credits_transferred / nullif(r.credits_required, 0), 1)
           as percent_transferred,
         r.transfers_accepted
    from student_academic_record r
   where r.credits_required is not null
     and r.credits_required > 0
     and r.credits_transferred >= r.credits_required / 2.0;

comment on view transfers_that_carry_most_of_the_award is
  'Students for whom half the award or more is another institution''s teaching. NOT A BREACH '
  'OF ANY RULE — the University has not set a cap, and this migration does not invent one. '
  'It is the list to settle the question from: most institutions cap transferable credit or '
  'require a residency, and ICOF has said nothing. Half is the threshold for LOOKING, not a '
  'limit being enforced.';


-- ===========================================================================
-- 6. THE PROOF
-- ===========================================================================
--
-- EVERYTHING IT TOUCHES IS ITS OWN — its own student, its own programme
-- version, its own courses, its own claims. It never counts the University's
-- transfer credits and never asserts how many they have.
-- ===========================================================================

do $$
declare
  stu       uuid;
  officer   uuid := gen_random_uuid();
  prog      uuid;
  ver       uuid;
  greek     uuid;
  hebrew    uuid;
  claim     uuid;
  unmapped  uuid;
  n         numeric;
  m         numeric;
  t         text;
  inst      text;
  refused_  boolean;
begin
  insert into auth.users (id, email) values (officer, 'proof-110@example.invalid');
  insert into profiles (id, email, full_name, role)
    values (officer, 'proof-110@example.invalid', 'Proof Dean 110', 'dean')
  on conflict (id) do update set role = excluded.role;

  -- ---- A PROGRAMME OF THIS PROOF'S OWN ----------------------------------
  -- A CODE THAT CANNOT BE THE UNIVERSITY'S. `programmes.code` is unique, and
  -- a proof that took `bth` or `bmin` would collide with a real programme the
  -- day somebody ran this twice.
  insert into programmes (code, award_level, status)
       values ('proof-110', 'Bachelor''s', 'draft')
    returning id into prog;
  insert into programme_versions (programme_id, version_label, name, duration_years,
                                  semesters_per_year, total_credits, effective_from, status)
       values (prog, 'PROOF-110', 'Proof Programme 110', 3, 2, 180, current_date, 'draft')
    returning id into ver;

  insert into courses (code, title, credit_unit)
       values ('PRF110A', 'Proof Greek 110', 20) returning id into greek;
  insert into courses (code, title, credit_unit)
       values ('PRF110B', 'Proof Hebrew 110', 20) returning id into hebrew;
  insert into curriculum_entries (programme_version_id, course_id, year, semester, requirement)
       values (ver, greek, 1, 1, 'core'), (ver, hebrew, 1, 2, 'core');

  insert into students (matric_no, first_name, last_name, status, programme_version_id)
       values ('PROOF-110', 'Proof', 'Transfer-110', 'enrolled', ver)
    returning id into stu;

  -- ---- NOTHING IS TRANSFERRED YET ---------------------------------------
  select credits_transferred, credits_total into n, m
    from student_academic_record where student_id = stu;
  if n <> 0 or m <> 0 then
    raise exception '110 FAILED — a student with no claims has % transferred credits', n;
  end if;
  raise notice '110 OK  a student with no claims has none';

  -- ---- A CLAIM IS RECORDED, AND COUNTS FOR NOTHING ----------------------
  --
  -- The state almost every claim is in for most of its life, and the one
  -- 019's boolean could not express at all.
  insert into transfer_credits (student_id, institution, course_code, course_title,
                                credits, equivalent_course_id, source_grade, submitted_by)
       values (stu, 'Proof Seminary 110', 'GRK101', 'Elementary Greek', 20, greek, 'A', officer)
    returning id into claim;

  if (select status from transfer_credits where id = claim) <> 'submitted' then
    raise exception '110 FAILED — a new claim did not arrive as submitted';
  end if;
  select credits_transferred into n from student_academic_record where student_id = stu;
  if n <> 0 then
    raise exception '110 FAILED — an undecided claim is already counting % credits', n;
  end if;
  select state into t from student_curriculum_progress
   where student_id = stu and course_id = greek;
  if t <> 'not-taken' then
    raise exception '110 FAILED — an undecided claim already shows as "%" on the sheet', t;
  end if;
  raise notice '110 OK  a claim nobody has decided counts for nothing, anywhere';

  -- ---- THE PATH IS ENFORCED. PROVED BY BREAKING IT ----------------------
  refused_ := false;
  begin
    update transfer_credits set status = 'accepted' where id = claim;
  exception when others then
    if sqlerrm not like 'A transfer credit cannot go from submitted to accepted%' then
      raise exception '110 FAILED — the path refused, but for the wrong reason: %', sqlerrm;
    end if;
    refused_ := true;
  end;
  if not refused_ then
    raise exception '110 FAILED — a claim was accepted without anybody reviewing it';
  end if;
  raise notice '110 OK  …and it cannot be accepted without being looked at first';

  -- AND A REFUSAL WITHOUT A REASON IS REFUSED.
  refused_ := false;
  begin
    update transfer_credits set status = 'refused' where id = claim;
  exception when check_violation then
    refused_ := true;
  end;
  if not refused_ then
    raise exception '110 FAILED — a claim was refused with no reason given';
  end if;
  raise notice '110 OK  …nor refused without the University saying why';

  -- ---- ACCEPTED, AND IT REACHES EVERYTHING ------------------------------
  update transfer_credits set status = 'under_review', reviewed_by = officer,
         reviewed_at = now() where id = claim;
  update transfer_credits set status = 'accepted', decided_by = officer where id = claim;

  if not (select accepted from transfer_credits where id = claim) then
    raise exception '110 FAILED — 019''s flag did not follow the status';
  end if;
  select credits_accepted into n from transfer_credits where id = claim;
  if n <> 20 then
    raise exception '110 FAILED — accepting without qualification took % of 20 credits', n;
  end if;
  raise notice '110 OK  accepting a claim sets 019''s flag and takes what was offered';

  select credits_earned, credits_transferred into n, m
    from student_academic_record where student_id = stu;
  if n <> 0 then
    raise exception '110 FAILED — a transfer credit was counted as ICOF teaching (% credits)', n;
  end if;
  if m <> 20 then
    raise exception '110 FAILED — the record shows % transferred credits, not 20', m;
  end if;
  select credits_total, credits_against_award into n, m
    from student_academic_record where student_id = stu;
  if n <> 20 then
    raise exception '110 FAILED — the total toward the award is %, not 20', n;
  end if;
  if m <> -160 then
    raise exception '110 FAILED — the distance from a 180-credit award is %, not -160', m;
  end if;
  raise notice '110 OK  …and it reaches the authoritative record, counted apart from ICOF''s own';

  select state, transferred_from into t, inst from student_curriculum_progress
   where student_id = stu and course_id = greek;
  if t <> 'transferred' then
    raise exception '110 FAILED — the progress sheet still says "%" for a transferred course', t;
  end if;
  -- AND NAMES WHERE IT CAME FROM. A credit on a progress sheet with no
  -- institution against it is a credit nobody can check.
  if inst <> 'Proof Seminary 110' then
    raise exception '110 FAILED — the sheet does not say which institution it came from (%)',
      coalesce(inst, 'nothing');
  end if;
  select state into t from student_curriculum_progress
   where student_id = stu and course_id = hebrew;
  if t <> 'not-taken' then
    raise exception '110 FAILED — a course nobody transferred reads "%"', t;
  end if;
  raise notice '110 OK  …and the progress sheet, for the course it stands for and no other';

  -- ---- AN UNMAPPED CREDIT IS NOT LOST -----------------------------------
  --
  -- The reason the total is summed from the claims and not from the progress
  -- sheet: the sheet can only show a credit that stands for a course of the
  -- curriculum, and this one stands for none.
  insert into transfer_credits (student_id, institution, course_title, credits,
                                status, submitted_by)
       values (stu, 'Proof Seminary 110', 'General Electives', 15, 'under_review', officer)
    returning id into unmapped;
  update transfer_credits set status = 'accepted', decided_by = officer where id = unmapped;

  select credits_transferred into n from student_academic_record where student_id = stu;
  if n <> 35 then
    raise exception '110 FAILED — an unmapped credit was dropped: % of 35', n;
  end if;
  raise notice '110 OK  a credit that stands for no particular course still counts';

  -- ---- AND THE GPA DOES NOT MOVE ----------------------------------------
  select cgpa into n from student_academic_record where student_id = stu;
  if n is not null then
    raise exception '110 FAILED — thirty-five transferred credits produced a CGPA of %', n;
  end if;
  if exists (select 1 from semester_gpas where student_id = stu) then
    raise exception '110 FAILED — accepting a transfer credit wrote to the GPA engine';
  end if;
  raise notice '110 OK  …and no transfer credit of any size moves the CGPA';

  -- ---- RESCINDING TAKES IT BACK, AND SAYS SO ----------------------------
  update transfer_credits
     set status = 'rescinded',
         decision_reason = 'The proof rescinds its own credit to watch the total fall.'
   where id = claim;

  select credits_transferred, credits_total into n, m
    from student_academic_record where student_id = stu;
  if n <> 15 then
    raise exception '110 FAILED — a rescinded credit is still counting: % of 15', n;
  end if;
  select state into t from student_curriculum_progress
   where student_id = stu and course_id = greek;
  if t <> 'not-taken' then
    raise exception '110 FAILED — a rescinded credit still fills its course, as "%"', t;
  end if;
  if (select credits_accepted from transfer_credits where id = claim) is not null then
    raise exception '110 FAILED — a rescinded credit kept its accepted figure';
  end if;
  raise notice '110 OK  rescinding takes a credit back out of the record and off the sheet';

  -- AND A RESCINDED ONE IS THE END OF IT.
  refused_ := false;
  begin
    update transfer_credits set status = 'accepted' where id = claim;
  exception when others then
    refused_ := true;
  end;
  if not refused_ then
    raise exception '110 FAILED — a rescinded credit was quietly accepted again';
  end if;
  raise notice '110 OK  …and a rescinded credit is the end of it; arguing it again is a new claim';

  -- ---- MORE THAN WAS OFFERED IS REFUSED ---------------------------------
  refused_ := false;
  begin
    insert into transfer_credits (student_id, institution, course_title, credits,
                                  credits_accepted, status)
         values (stu, 'Proof Seminary 110', 'Too Generous', 10, 40, 'under_review');
  exception when check_violation then
    refused_ := true;
  end;
  if not refused_ then
    raise exception '110 FAILED — forty credits were accepted for a ten-credit course';
  end if;
  raise notice '110 OK  and no more may be accepted than the other institution gave';

  -- ---- THE QUESTION IS ASKED, NOT ANSWERED ------------------------------
  --
  -- 90 of 180 is exactly half, so this student appears. NOTHING REFUSED IT:
  -- the University has set no cap and this migration does not invent one.
  update transfer_credits set credits = 90 where id = unmapped;
  update transfer_credits set credits_accepted = 90 where id = unmapped;
  if not exists (select 1 from transfers_that_carry_most_of_the_award where student_id = stu) then
    raise exception '110 FAILED — half an award in transferred credit is on no list';
  end if;
  select percent_transferred into n
    from transfers_that_carry_most_of_the_award where student_id = stu;
  if n <> 50.0 then
    raise exception '110 FAILED — ninety of a hundred and eighty is reported as %%%', n;
  end if;
  raise notice '110 OK  half a degree in another institution''s teaching is LISTED, not '
               'refused — the University has set no cap and this does not invent one';

  raise exception 'ROLLBACK 110';
exception
  when others then
    if sqlerrm = 'ROLLBACK 110' then
      raise notice '110 OK  every proof above rolled back; no claim, student or course of '
                   'the University''s was written to';
    else
      raise;
    end if;
end $$;


-- ===========================================================================
-- 7. DONE
-- ===========================================================================
do $$
begin
  raise notice '110 APPLIED  a transfer credit now reaches the authoritative record, the '
               'progress sheet and therefore graduation — counted APART from credit earned '
               'at ICOF, which is the University''s decision of 16 September 2026. It is '
               'never scored: the CGPA stays a measure of ICOF''s own teaching. Any student '
               'already holding an accepted credit is closer to their award than the system '
               'was saying. No cap on transferred credit is invented or enforced; '
               '`transfers_that_carry_most_of_the_award` lists the cases so the University '
               'can settle the question.';
end $$;

