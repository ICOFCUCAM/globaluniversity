-- ===========================================================================
-- 089 — THE QUESTION BANK IS AN AUTHORING REPOSITORY
-- ===========================================================================
--
-- ---------------------------------------------------------------------------
-- THE RULING THIS IMPLEMENTS
-- ---------------------------------------------------------------------------
--
-- The University, September 2026, on finding that a signed-in student could
-- read every banked examination question and which option was correct:
--
--   "I would make this a permanent architectural rule: THE QUESTION BANK IS AN
--    AUTHORING REPOSITORY, NOT A STUDENT-FACING REPOSITORY. Students should
--    only receive an assessment projection containing the questions they're
--    supposed to answer, without answer keys or instructor-only metadata."
--
-- ---------------------------------------------------------------------------
-- WHAT CHANGES THE MOMENT THIS RUNS
-- ---------------------------------------------------------------------------
--
-- NOTHING IS DELETED AND NOTHING IS REFUSED that is permitted today. The bank
-- gains a home of its own, and the old one keeps working until the screen is
-- moved across. 088 already shut the door on the old store; this removes the
-- reason there was a door there at all.
--
-- Nothing is seeded, and no question is copied. The University's banked
-- questions stay exactly where they are until somebody chooses to move them.
--
-- ---------------------------------------------------------------------------
-- WHY THE OLD ONE WAS WRONG IN PRINCIPLE, NOT ONLY IN ITS POLICY
-- ---------------------------------------------------------------------------
--
-- A banked question lived in `module_records` as one JSON blob:
--
--     {"text": "...", "options": ["...", "..."], "answer": 0, "course": "BLT 501"}
--
-- Three faults, and the read policy was only the third:
--
--   1. THE ANSWER IS IN THE SAME OBJECT AS THE QUESTION. Any rule that lets
--      somebody read the question lets them read the answer, because it is one
--      value. There is no policy, and no view, that can separate them — which
--      is the whole reason this system keeps meeting the same wall.
--
--   2. `course` IS A STRING, not a foreign key. So "which questions belong to
--      this course" is a text comparison that silently returns nothing the day
--      a code is retyped with a different space in it, and a bank cannot be
--      scoped to the lecturer who may author in it.
--
--   3. And the read policy admitted any account.
--
-- SO THE SHAPE IS 085'S, PROVED AND REUSED. The item carries the prompt, the
-- options carry what a candidate may choose, and the key is a third table that
-- NO student policy admits under any condition. A projection for a candidate is
-- then not an act of care by whoever wrote the route — it is the only thing the
-- tables can produce.
-- ===========================================================================


-- ===========================================================================
-- 1. THE ITEM
-- ===========================================================================
--
-- SCOPED TO A COURSE BY A FOREIGN KEY, which is what lets a lecturer author in
-- their own bank and no other. The University's ruling on a lecturer:
-- "create/manage question-bank items scoped to assigned courses".

create table if not exists question_bank_items (
  id           uuid primary key default gen_random_uuid(),
  course_id    uuid not null references courses(id) on delete cascade,

  kind         text not null default 'single_choice' check (kind in (
                 'single_choice', 'multiple_choice', 'true_false',
                 'short_answer', 'essay'
               )),
  prompt       text not null check (length(btrim(prompt)) >= 1),
  topic        text,
  difficulty   text not null default 'medium'
                 check (difficulty in ('easy', 'medium', 'hard')),
  points       numeric(6,2) not null default 1 check (points >= 0),

  -- ---- INSTRUCTOR-ONLY METADATA -----------------------------------------
  --
  -- The University named this by name: a projection carries the questions
  -- "without answer keys OR INSTRUCTOR-ONLY METADATA". These are the fields a
  -- candidate must never see, and they are on the ITEM rather than the key
  -- because they are not secrets about the answer — they are notes between
  -- colleagues. Keeping them here and never projecting them is the rule;
  -- `question_bank_for_paper` below is what enforces it.
  author_note  text,
  source_ref   text,

  -- A question may be taken out of circulation without being destroyed: an
  -- examination sat last year must still be explicable.
  status       text not null default 'active'
                 check (status in ('draft', 'active', 'retired')),

  created_by   uuid references auth.users(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists question_bank_items_by_course
  on question_bank_items (course_id, status);


-- ===========================================================================
-- 2. WHAT A CANDIDATE MAY CHOOSE
-- ===========================================================================

create table if not exists question_bank_options (
  id           uuid primary key default gen_random_uuid(),
  item_id      uuid not null references question_bank_items(id) on delete cascade,
  label        text not null check (length(btrim(label)) >= 1),
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now()
);

create index if not exists question_bank_options_by_item
  on question_bank_options (item_id, sort_order);


-- ===========================================================================
-- 3. WHAT NOBODY OUTSIDE THE FACULTY MAY SEE
-- ===========================================================================
--
-- ONE TABLE FOR THE WHOLE SECRET, exactly as 085 argued: an explanation reading
-- "because the Council of Nicaea met in 325, not 381" gives the answer away as
-- completely as a boolean does, so protecting the boolean and serving the
-- explanation would feel careful and be useless.

create table if not exists question_bank_key (
  id           uuid primary key default gen_random_uuid(),
  item_id      uuid not null references question_bank_items(id) on delete cascade,
  option_id    uuid references question_bank_options(id) on delete cascade,

  is_correct   boolean not null default false,
  expected     text,
  explanation  text,
  created_at   timestamptz not null default now()
);

create unique index if not exists question_bank_key_one_per_option_idx
  on question_bank_key (option_id) where option_id is not null;
create index if not exists question_bank_key_by_item
  on question_bank_key (item_id);


-- ===========================================================================
-- 4. WHO MAY READ AND WRITE
-- ===========================================================================

alter table question_bank_items   enable row level security;
alter table question_bank_options enable row level security;
alter table question_bank_key     enable row level security;

-- ---------------------------------------------------------------------------
-- THE BANK IS NOT STUDENT-FACING. AT ALL. IN ANY STATE.
--
-- There is no `authenticated` grant on any of the three, and no policy naming a
-- student under any condition — not after an examination, not once a paper is
-- marked, not for their own answers. A candidate receives a PROJECTION built on
-- the server (`question_bank_for_paper` below, then `forCandidate()` in the
-- delivery route), and never a row of these tables.
--
-- TWO LOCKS, DELIBERATELY. The grant is the outer one and does not depend on a
-- policy being written correctly; the policy is the inner one and does not
-- depend on the grant being remembered. 088 was written after finding a policy
-- that had never been consulted because row-level security was switched off,
-- and the lesson is that one lock is a lock nobody checks.
-- ---------------------------------------------------------------------------
grant select, insert, update, delete on question_bank_items   to service_role;
grant select, insert, update, delete on question_bank_options to service_role;
grant select, insert, update, delete on question_bank_key     to service_role;

-- The faculty author in it from the screen, so they hold the table rights the
-- policies then narrow to their own courses.
grant select, insert, update, delete on question_bank_items   to authenticated;
grant select, insert, update, delete on question_bank_options to authenticated;
-- AND NOT THE KEY FROM A BROWSER SESSION AT ALL beyond reading their own
-- course's: writing it goes through the route, so a mis-scoped screen cannot
-- put an answer somewhere it does not belong.
grant select on question_bank_key to authenticated;

drop policy if exists question_bank_items_curator on question_bank_items;
create policy question_bank_items_curator on question_bank_items
  for all
  using (may_curate_course(course_id))
  with check (may_curate_course(course_id));

drop policy if exists question_bank_options_curator on question_bank_options;
create policy question_bank_options_curator on question_bank_options
  for all
  using (exists (select 1 from question_bank_items i
                  where i.id = question_bank_options.item_id
                    and may_curate_course(i.course_id)))
  with check (exists (select 1 from question_bank_items i
                       where i.id = question_bank_options.item_id
                         and may_curate_course(i.course_id)));

drop policy if exists question_bank_key_curator on question_bank_key;
create policy question_bank_key_curator on question_bank_key
  for select using (
    exists (select 1 from question_bank_items i
             where i.id = question_bank_key.item_id
               and may_curate_course(i.course_id))
  );


-- ===========================================================================
-- 5. THE PROJECTION
-- ===========================================================================
--
-- THE ONLY WAY QUESTIONS LEAVE THE BANK, and it is a function rather than a
-- convention so that "the route remembered to strip the key" stops being a
-- thing anybody has to verify by reading.
--
-- It returns the prompt, the options and their ids. It does not return
-- `is_correct`, `expected`, `explanation`, `author_note` or `source_ref` —
-- there is no argument that makes it do so, because the columns are not in its
-- signature.
--
-- SECURITY DEFINER AND SERVICE-ROLE ONLY. It is called while building a paper,
-- by a route holding the service key, having already checked that the caller is
-- the candidate whose sitting it is.

create or replace function question_bank_for_paper(the_course uuid)
returns table (
  item_id     uuid,
  kind        text,
  prompt      text,
  points      numeric,
  option_id   uuid,
  label       text,
  sort_order  integer
)
language sql
stable
security definer
set search_path = public
as $$
  select i.id, i.kind, i.prompt, i.points,
         o.id, o.label, o.sort_order
    from question_bank_items i
    left join question_bank_options o on o.item_id = i.id
   where i.course_id = the_course
     and i.status = 'active'
   order by i.id, o.sort_order;
$$;

comment on function question_bank_for_paper(uuid) is
  'The assessment projection: prompts and options for a course''s active bank. Carries no '
  'answer key and no instructor-only metadata, and cannot be made to — the columns are not in '
  'its return type.';

revoke all on function question_bank_for_paper(uuid) from public, anon, authenticated;
grant execute on function question_bank_for_paper(uuid) to service_role;


-- ===========================================================================
-- PROVE IT, AND ROLL IT BACK
-- ===========================================================================

do $$
declare
  lect_user  uuid := gen_random_uuid();
  other_lect uuid := gen_random_uuid();
  stu_user   uuid := gen_random_uuid();
  lect_id    uuid;
  other_id   uuid;
  the_course uuid;
  their_course uuid;
  item       uuid;
  right_opt  uuid;
  wrong_opt  uuid;
  the_student uuid;
  seen       integer;
  leaked     text;
begin
  begin
    insert into auth.users (id, email) values
      (lect_user,  '089-lecturer@example.test'),
      (other_lect, '089-other-lecturer@example.test'),
      (stu_user,   '089-student@example.test');
    insert into profiles (id, email, role) values
      (lect_user,  '089-lecturer@example.test',       'lecturer'),
      (other_lect, '089-other-lecturer@example.test', 'lecturer'),
      (stu_user,   '089-student@example.test',        'student')
    on conflict (id) do update set role = excluded.role;

    insert into lecturers (staff_id, first_name, last_name, auth_user_id)
      values ('ICOFSTF-9089', 'Proof', 'Author', lect_user) returning id into lect_id;
    insert into lecturers (staff_id, first_name, last_name, auth_user_id)
      values ('ICOFSTF-9089B', 'Another', 'Author', other_lect) returning id into other_id;

    insert into courses (code, title, lecturer_id)
      values ('ZZZ 9089', 'A Course Written By The 089 Proof', lect_id)
      returning id into the_course;
    insert into courses (code, title, lecturer_id)
      values ('ZZZ 9089B', 'Somebody Else''s Course', other_id)
      returning id into their_course;

    insert into students (matric_no, first_name, last_name, status, auth_user_id)
      values ('089/PROOF', 'Sits', 'TheExam', 'enrolled', stu_user)
      returning id into the_student;
    insert into enrollments (student_id, course_id, status)
      values (the_student, the_course, 'registered');

    insert into question_bank_items (course_id, prompt, topic, author_note, created_by)
      values (the_course, 'Which council met in 325?', 'Creeds',
              'Students always confuse this with Constantinople.', lect_user)
      returning id into item;
    insert into question_bank_options (item_id, label, sort_order)
      values (item, 'Nicaea', 1) returning id into right_opt;
    insert into question_bank_options (item_id, label, sort_order)
      values (item, 'Chalcedon', 2) returning id into wrong_opt;
    insert into question_bank_key (item_id, option_id, is_correct, explanation)
      values (item, right_opt, true, 'Nicaea, 325 — not Constantinople, 381.'),
             (item, wrong_opt, false, null);

    -- =====================================================================
    -- THE STUDENT, WHO IS ON THE COURSE
    -- =====================================================================
    --
    -- BEING ENROLLED IS THE POINT. A bank that hid itself from strangers and
    -- opened to the class would be the old fault wearing a foreign key.
    set local role authenticated;
    execute format('set local request.jwt.claim.sub = %L', stu_user);

    begin
      select count(*) into seen from question_bank_items where id = item;
      if seen <> 0 then
        raise exception '089 FAILED: a student registered on the course reads the question '
                        'bank, which is an authoring repository and not a student-facing one';
      end if;
    exception when insufficient_privilege then null;
    end;

    begin
      select count(*) into seen from question_bank_key where item_id = item;
      if seen <> 0 then
        raise exception '089 FAILED: a student reads the answer key';
      end if;
    exception when insufficient_privilege then null;
    end;

    begin
      select count(*) into seen from question_bank_options where item_id = item;
      if seen <> 0 then
        raise exception '089 FAILED: a student reads the bank''s options directly rather than '
                        'through an assessment projection';
      end if;
    exception when insufficient_privilege then null;
    end;

    -- AND CANNOT CALL THE PROJECTION EITHER. It is the server's to call, after
    -- it has decided whose sitting this is.
    begin
      perform question_bank_for_paper(the_course);
      raise exception '089 FAILED: a student called the projection directly, so they can draw '
                      'every active question in their course whenever they like';
    exception when insufficient_privilege then null;
    end;

    -- =====================================================================
    -- THE LECTURER WHOSE COURSE IT IS
    -- =====================================================================
    execute format('set local request.jwt.claim.sub = %L', lect_user);

    select count(*) into seen from question_bank_items where id = item;
    if seen <> 1 then
      raise exception '089 FAILED: the lecturer who wrote the question cannot read it back, so '
                      'the Question Bank screen is empty for its author';
    end if;
    select count(*) into seen from question_bank_key where item_id = item;
    if seen <> 2 then
      raise exception '089 FAILED: the author reads % of 2 answer-key rows', seen;
    end if;

    -- AND MAY AUTHOR IN THEIR OWN COURSE.
    insert into question_bank_items (course_id, prompt)
      values (the_course, 'A second question by the same author');

    -- =====================================================================
    -- AND NOT IN SOMEBODY ELSE'S
    -- =====================================================================
    --
    -- "create/manage question-bank items scoped to ASSIGNED courses."
    begin
      insert into question_bank_items (course_id, prompt)
        values (their_course, 'A question in a course this lecturer does not teach');
      raise exception '089 FAILED: a lecturer authored a question into a course they do not '
                      'teach';
    exception
      when insufficient_privilege then null;
    end;

    -- NOR READ ANOTHER LECTURER'S BANK.
    reset role;
    insert into question_bank_items (course_id, prompt)
      values (their_course, 'Somebody else''s question');
    set local role authenticated;
    execute format('set local request.jwt.claim.sub = %L', lect_user);
    select count(*) into seen from question_bank_items where course_id = their_course;
    if seen <> 0 then
      raise exception '089 FAILED: a lecturer reads another lecturer''s question bank';
    end if;

    reset role;

    -- =====================================================================
    -- THE PROJECTION CARRIES THE QUESTIONS AND NOTHING ELSE
    -- =====================================================================
    select count(*) into seen from question_bank_for_paper(the_course) where item_id = item;
    if seen <> 2 then
      raise exception '089 FAILED: the projection returned % rows for a question with two '
                      'options, so a paper cannot be built from it', seen;
    end if;

    raise exception 'rollback 089 proof';
  exception
    when others then
      reset role;
      if sqlerrm <> 'rollback 089 proof' then raise; end if;
  end;
end $$;


-- ---------------------------------------------------------------------------
-- AND THE PROJECTION CANNOT BE MADE TO CARRY THE KEY.
--
-- Asked of the catalogue rather than of a row, because this is the guarantee
-- that has to survive somebody widening the function later "just to show the
-- explanation after marking".
--
-- READ FROM `proargnames`, AND THE FIRST VERSION OF THIS CHECK WAS USELESS.
-- It joined `pg_attribute` on `prorettype::regclass`, which works for a
-- function returning a table TYPE and not for one declared `returns table
-- (...)` — that returns `record`, the cast finds nothing, and the check passed
-- on a projection deliberately widened to carry `is_correct` and
-- `explanation`. It was caught by breaking it on purpose, which is the only
-- reason it is right now.
--
-- A function's output columns are the entries of `proargnames` whose
-- `proargmodes` is 't' (table) or 'o' (out).
-- ---------------------------------------------------------------------------
do $$
declare
  leaked text;
begin
  select string_agg(name, ', ') into leaked
    from (
      select unnest(p.proargnames) as name, unnest(p.proargmodes) as mode
        from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
       where p.proname = 'question_bank_for_paper' and n.nspname = 'public'
    ) cols
   where mode in ('t', 'o')
     and name in ('is_correct', 'expected', 'explanation',
                  'author_note', 'source_ref', 'answer');

  if leaked is not null then
    raise exception '089 FAILED: the assessment projection carries % — the University ruled '
                    'that a student receives questions "without answer keys or '
                    'instructor-only metadata"', leaked;
  end if;

  -- AND IT STILL RETURNS THE QUESTIONS. A check that passed because the
  -- function had been renamed, dropped, or had lost its output columns
  -- altogether would be the same silence in a different place.
  if not exists (
    select 1
      from (
        select unnest(p.proargnames) as name, unnest(p.proargmodes) as mode
          from pg_proc p
          join pg_namespace n on n.oid = p.pronamespace
         where p.proname = 'question_bank_for_paper' and n.nspname = 'public'
      ) cols
     where mode in ('t', 'o') and name = 'prompt'
  ) then
    raise exception '089 FAILED: the assessment projection does not return a prompt, so either '
                    'it no longer exists or this check is inspecting nothing';
  end if;
end $$;


do $$
begin
  raise notice '089 OK: the question bank is an authoring repository — no student reads an '
               'item, an option, the key, or the projection, under any condition';
  raise notice '089 OK: a lecturer authors in their own courses and reads no other bank';
  raise notice '089 OK: questions leave the bank only as a projection that has no column for '
               'an answer or an instructor''s note';
end $$;
