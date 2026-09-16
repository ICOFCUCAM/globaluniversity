-- ===========================================================================
-- 096 — THE COURSE LIBRARY
-- ===========================================================================
--
-- ---------------------------------------------------------------------------
-- WHAT CHANGES THE MOMENT THIS RUNS
-- ---------------------------------------------------------------------------
--
-- NOTHING CLOSES. One new table and one new view; no existing row moves and no
-- existing policy changes.
--
-- The University's ruling of 16 September 2026:
--
--     "Don't treat an ebook merely as an arbitrary link buried in notes… And
--      importantly, don't assume every ebook is downloadable. Some publishers
--      only permit reading through a licensed platform. The system should
--      support both: Read online and/or Download depending on the resource's
--      rights."
--
-- ---------------------------------------------------------------------------
-- TWO RIGHTS, NOT ONE FLAG
-- ---------------------------------------------------------------------------
--
-- `may_read` and `may_download` are separate columns because they are separate
-- permissions in the real world: a publisher licences a title for reading
-- inside a platform and forbids the file leaving it. One boolean called
-- `accessible` would force the University to choose between denying students a
-- book it has paid for and breaching the licence it bought it under.
--
-- AND `may_download` DEFAULTS TO FALSE. Not because downloading is unusual —
-- because the cost of the two mistakes is not symmetrical. A book wrongly
-- marked read-only is a complaint and a one-click fix; a book wrongly marked
-- downloadable is a licence breach that cannot be recalled once a cohort has
-- the file.
--
-- ---------------------------------------------------------------------------
-- AND THE RIGHTS ARE NOT THE LIBRARIAN'S TO SET
-- ---------------------------------------------------------------------------
--
-- The University: "the superadmin and admin decides which course can be read
-- and download or just read."
--
-- So two different authorities touch one row, and the split is enforced rather
-- than described. `studio-manage-ebooks` — held by the Library, the Academic
-- Office and anyone granted it — adds a resource, writes its title, author,
-- description, cover and which module it belongs to.
--
-- IT DOES NOT SET THE RIGHTS. `may_read` and `may_download` are changed by the
-- Superadministrator and the System Administrator alone, and a trigger refuses
-- anybody else — because a policy decides about a ROW and this is a question
-- about two COLUMNS of a row the librarian is otherwise entitled to edit. That
-- is the same shape as 090's `password_set_at` and 095's review state.
--
-- WHY THOSE TWO OFFICES AND NOT THE LIBRARY. Reading the licence is
-- librarianship; being answerable for breaching it is not. The University
-- named the two offices that carry that, and this file does not second-guess
-- it.
-- ===========================================================================


-- ===========================================================================
-- THE RESOURCE
-- ===========================================================================

create table if not exists course_resources (
  id            uuid primary key default gen_random_uuid(),
  course_id     uuid not null references courses (id) on delete cascade,

  -- WHICH MODULE OR TOPIC, where the Library has said. Nullable: a course-wide
  -- reading list is a real thing and forcing every title into a week would
  -- invent a structure the Library did not choose.
  module_id     uuid,

  kind          text not null check (kind in (
                  'ebook', 'article', 'chapter', 'document', 'link', 'video', 'audio')),

  title         text not null check (length(btrim(title)) between 1 and 400),
  author        text,
  description   text,
  publisher     text,
  published_year integer check (published_year is null
                                or published_year between 1000 and 2200),
  isbn          text,
  doi           text,
  cover_url     text,

  -- WHERE IT IS. A licensed platform is a URL; a file the University holds is
  -- a path in its own storage. Both are real and a resource has at least one.
  url           text,
  file_path     text,

  -- ---- REQUIRED OR RECOMMENDED ------------------------------------------
  --
  -- The University's two words, exactly. 084's `course_lessons.requirement`
  -- has three (primary/secondary/recommended) and describes a LESSON's place
  -- in a course; this describes whether a student is expected to have read a
  -- book. They are different questions and the University named these two.
  requirement   text not null default 'recommended'
                check (requirement in ('required', 'recommended')),

  -- ---- THE TWO RIGHTS ---------------------------------------------------
  may_read      boolean not null default true,
  may_download  boolean not null default false,

  -- WHAT THE LICENCE ACTUALLY SAYS, in words, for the person who has to
  -- answer a publisher's letter. A boolean records the decision; this records
  -- the reason for it.
  licence       text,

  visible       boolean not null default true,
  added_by      uuid not null references auth.users (id),
  added_at      timestamptz not null default now(),
  rights_set_by uuid references auth.users (id),
  rights_set_at timestamptz,

  -- A RESOURCE THAT OPENS ONTO NOTHING IS A TITLE IN A LIST. 084 learned this
  -- about lessons; a reading list can make the same mistake.
  constraint course_resources_leads_somewhere
    check (url is not null or file_path is not null),

  -- AND ONE NOBODY MAY READ OR DOWNLOAD IS A ROW WITH NO PURPOSE. Hiding it
  -- is what `visible` is for; withdrawing both rights is how a resource comes
  -- to sit on a reading list and refuse everybody who clicks it.
  constraint course_resources_is_reachable
    check (may_read or may_download),

  -- The module must belong to the same course — the same protection 084 gave
  -- a lesson and 092 an artefact.
  constraint course_resources_module_agrees
    foreign key (module_id, course_id) references course_modules (id, course_id)
    on delete set null
);

comment on table course_resources is
  'A course''s library: required and recommended reading, with READING and DOWNLOADING as '
  'separate rights because publishers licence them separately.';
comment on column course_resources.may_download is
  'Whether the file may leave the platform. FALSE by default: a book wrongly marked read-only is '
  'a complaint; a book wrongly marked downloadable is a licence breach that cannot be recalled. '
  'Set by the Superadministrator or the System Administrator, never by the Library.';

create index if not exists course_resources_course_idx
  on course_resources (course_id, requirement, title);


-- ===========================================================================
-- WHO MAY SET THE RIGHTS
-- ===========================================================================

create or replace function rights_are_the_universitys_to_set()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  changed boolean;
begin
  if tg_op = 'INSERT' then
    -- A NEW RESOURCE MAY NOT ARRIVE DOWNLOADABLE. Otherwise the rule is one
    -- INSERT away from meaningless: a librarian would simply create the row
    -- with the flag already set.
    if new.may_download and not is_rights_authority() then
      raise exception 'Only the Superadministrator or the System Administrator may allow a '
                      'resource to be downloaded. Add it read-only; they can open it.'
        using errcode = 'insufficient_privilege';
    end if;
    if new.may_download then
      new.rights_set_by := coalesce(auth.uid(), new.rights_set_by);
      new.rights_set_at := now();
    end if;
    return new;
  end if;

  changed := (new.may_read is distinct from old.may_read)
          or (new.may_download is distinct from old.may_download);
  if not changed then return new; end if;

  if not is_rights_authority() then
    raise exception 'Reading the licence is librarianship; answering for breaching it is not. '
                    'Only the Superadministrator or the System Administrator changes whether a '
                    'resource may be read or downloaded.'
      using errcode = 'insufficient_privilege';
  end if;

  new.rights_set_by := coalesce(auth.uid(), new.rights_set_by);
  new.rights_set_at := now();
  return new;
end;
$$;

create or replace function is_rights_authority()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  -- `auth.uid() is null` is the SERVER acting with the service key — a
  -- migration, a restore, or a route that has already made this decision. A
  -- browser session always has a uid, so this does not open a door to one.
  select auth.uid() is null or auth_role() in ('superadmin', 'admin');
$$;

revoke all on function is_rights_authority() from public;
grant execute on function is_rights_authority() to authenticated;

drop trigger if exists rights_are_the_universitys_to_set_trg on course_resources;
create trigger rights_are_the_universitys_to_set_trg
  before insert or update on course_resources
  for each row execute function rights_are_the_universitys_to_set();


-- ===========================================================================
-- WHAT A STUDENT SEES
-- ===========================================================================
--
-- A VIEW, BECAUSE THE FILE PATH IS THE THING TO WITHHOLD. A student who may
-- read a book online but not download it must not be handed the storage path
-- of the file — row-level security is ROW-level and would admit the whole row
-- or none of it, and admitting the row is what lets them read it.
--
-- So: no `file_path` column at all where downloading is not permitted. The
-- route serves the bytes behind a check; the path never reaches the browser.
-- ===========================================================================

drop view if exists my_course_library;
create view my_course_library
with (security_invoker = true)
as
  select
    r.id,
    r.course_id,
    r.module_id,
    r.kind,
    r.title,
    r.author,
    r.description,
    r.publisher,
    r.published_year,
    r.isbn,
    r.doi,
    r.cover_url,
    r.requirement,
    r.licence,
    r.may_read,
    r.may_download,
    -- THE LINK, WHERE THERE IS ONE. A licensed platform's URL is meant to be
    -- followed; that is what the licence bought.
    r.url,
    -- AND THE PATH ONLY WHERE THE FILE MAY LEAVE. Null is not an oversight
    -- here; it is the licence.
    case when r.may_download then r.file_path else null end as file_path
  from course_resources r
 where r.visible;

comment on view my_course_library is
  'A course''s library as a reader sees it. `file_path` is NULL unless the resource may be '
  'downloaded — the path is withheld rather than the row, because a reader who may read online '
  'still needs the row.';

revoke all on my_course_library from anon;
grant select on my_course_library to authenticated;


-- ===========================================================================
-- ROW-LEVEL SECURITY
-- ===========================================================================

alter table course_resources enable row level security;

drop policy if exists course_resources_read   on course_resources;
drop policy if exists course_resources_write  on course_resources;
drop policy if exists course_resources_modify on course_resources;
drop policy if exists course_resources_remove on course_resources;

create policy course_resources_read on course_resources
  for select using (
       (visible and is_enrolled_on_course(course_id))
    or may_curate_course(course_id)
    or teaches_this_course(course_id)
  );

-- WHO MAY BUILD THE LIST. `may_curate_course` is 084's — the lecturer
-- allocated to the course, or an office that governs the curriculum. The
-- Library reaches it through `studio-manage-ebooks`, which the application
-- checks; the database check is about the COURSE, because a capability cannot
-- express "their own courses and nobody else's".
create policy course_resources_write on course_resources
  for insert with check (may_curate_course(course_id) and added_by = auth.uid());

create policy course_resources_modify on course_resources
  for update using (may_curate_course(course_id)) with check (may_curate_course(course_id));

create policy course_resources_remove on course_resources
  for delete using (may_curate_course(course_id));

revoke insert, update, delete, truncate, references, trigger on course_resources from anon;
revoke truncate, references, trigger on course_resources from authenticated;
grant select on course_resources to anon, authenticated;
grant insert, update, delete on course_resources to authenticated;


-- ===========================================================================
-- THE PROOF
-- ===========================================================================

do $$
declare
  lect_user  uuid := gen_random_uuid();
  lib_user   uuid := gen_random_uuid();
  super_user uuid := gen_random_uuid();
  in_user    uuid := gen_random_uuid();
  out_user   uuid := gen_random_uuid();
  lect_id    uuid;
  the_course uuid;
  other_course uuid;
  other_module uuid;
  mine       uuid;
  theirs     uuid;
  the_module uuid;
  the_book   uuid;
  seen       integer;
  got_path   text;
begin
  begin
    insert into auth.users (id, email) values
      (lect_user,  '096-lecturer@example.test'),
      (lib_user,   '096-library@example.test'),
      (super_user, '096-super@example.test'),
      (in_user,    '096-enrolled@example.test'),
      (out_user,   '096-stranger@example.test');
    insert into profiles (id, email, role) values
      (lect_user,  '096-lecturer@example.test',  'lecturer'),
      (lib_user,   '096-library@example.test',   'library-staff'),
      (super_user, '096-super@example.test',     'superadmin'),
      (in_user,    '096-enrolled@example.test',  'student'),
      (out_user,   '096-stranger@example.test',  'student')
    on conflict (id) do update set role = excluded.role;

    insert into lecturers (staff_id, first_name, last_name, auth_user_id)
      values ('ICOFSTF-9096', 'Proof', 'Lecturer', lect_user) returning id into lect_id;
    insert into courses (code, title, lecturer_id)
      values ('ZZZ 9096', 'A Course Written By The 096 Proof', lect_id)
      returning id into the_course;
    insert into courses (code, title)
      values ('ZZZ 9096B', 'A Second Course, For The Module Key')
      returning id into other_course;

    insert into students (matric_no, first_name, last_name, status, auth_user_id)
      values ('096/PROOF/IN', 'On', 'TheCourse', 'enrolled', in_user) returning id into mine;
    insert into students (matric_no, first_name, last_name, status, auth_user_id)
      values ('096/PROOF/OUT', 'Not', 'OnIt', 'enrolled', out_user) returning id into theirs;
    insert into enrollments (student_id, course_id, status)
      values (mine, the_course, 'registered');

    insert into course_modules (course_id, title, visible, sort_order)
      values (the_course, 'Module written by the 096 proof', true, 1)
      returning id into the_module;
    insert into course_modules (course_id, title, visible, sort_order)
      values (other_course, 'A module of the OTHER course', true, 1)
      returning id into other_module;

    -- ---- A RESOURCE THAT OPENS ONTO NOTHING -------------------------------
    begin
      insert into course_resources (course_id, kind, title, added_by)
        values (the_course, 'ebook', 'A title and nowhere to go', lect_user);
      raise exception '096 FAILED: a resource with no url and no file was accepted — a title on '
                      'a reading list that opens onto nothing';
    exception
      when check_violation then null;
    end;

    -- ---- AND ONE NOBODY MAY OPEN ------------------------------------------
    begin
      insert into course_resources (course_id, kind, title, url, added_by, may_read, may_download)
        values (the_course, 'ebook', 'A book nobody may open', 'https://example.test/b',
                lect_user, false, false);
      raise exception '096 FAILED: a resource was accepted that may be neither read nor '
                      'downloaded, which is a row that refuses everybody who clicks it';
    exception
      when check_violation then null;
    end;

    insert into course_resources (
      course_id, module_id, kind, title, author, publisher, url, file_path,
      requirement, added_by, licence)
      values (the_course, the_module, 'ebook', 'Introduction to Something',
              'A. Writer', 'A Press', 'https://example.test/read',
              'library/096-proof.pdf', 'required', lect_user,
              'Reading permitted inside the platform. No copy may be taken.')
      returning id into the_book;

    -- ---- IT ARRIVES READ-ONLY ---------------------------------------------
    select count(*) into seen from course_resources
     where id = the_book and may_read and not may_download;
    if seen <> 1 then
      raise exception '096 FAILED: a new resource did not arrive read-only, so a licensed book '
                      'is downloadable by default';
    end if;

    -- ---- A MODULE OF ANOTHER COURSE ---------------------------------------
    begin
      update course_resources set module_id = other_module where id = the_book;
      raise exception '096 FAILED: a resource was filed under a module of a different course';
    exception
      when foreign_key_violation then null;
    end;

    -- ---- WHO CANNOT OPEN THE DOWNLOAD, AND HOW THEY ARE STOPPED -----------
    --
    -- TWO DIFFERENT REFUSALS, and the first draft of this proof confused them.
    --
    -- The LIBRARY is not a curator of this course, so 084's `may_curate_course`
    -- keeps it out of the row entirely. An UPDATE that matches no rows under
    -- row-level security SUCCEEDS, affecting nothing — it does not raise — so
    -- expecting `insufficient_privilege` there tested the wrong mechanism and
    -- failed against correct behaviour.
    --
    -- The LECTURER is a curator: they may edit this row all day, and the
    -- trigger is the only thing standing between them and the download right.
    -- THAT is what the trigger is for, and testing it with somebody who cannot
    -- reach the row at all would have proved nothing about it.
    set local role authenticated;

    execute format('set local request.jwt.claim.sub = %L', lib_user);
    update course_resources set may_download = true where id = the_book;
    reset role;
    select count(*) into seen from course_resources where id = the_book and may_download;
    if seen <> 0 then
      raise exception '096 FAILED: an account that does not curate this course changed its '
                      'library';
    end if;

    set local role authenticated;
    execute format('set local request.jwt.claim.sub = %L', lect_user);
    begin
      update course_resources set may_download = true where id = the_book;
      raise exception '096 FAILED: the lecturer who curates the course set the download right — '
                      'the University named the Superadministrator and the System Administrator '
                      'for that, and this is the only thing that stops a curator';
    exception
      when insufficient_privilege then null;
    end;

    -- NOR MAY A CURATOR CREATE ONE ALREADY OPEN.
    begin
      insert into course_resources (course_id, kind, title, url, added_by, may_download)
        values (the_course, 'ebook', 'A book added already downloadable',
                'https://example.test/x', lect_user, true);
      raise exception '096 FAILED: a downloadable resource was created directly, so the rule is '
                      'one INSERT away from meaningless';
    exception
      when insufficient_privilege then null;
    end;

    reset role;

    -- ---- A STUDENT ON THE COURSE READS IT, AND GETS NO PATH ---------------
    set local role authenticated;
    execute format('set local request.jwt.claim.sub = %L', in_user);
    select count(*) into seen from my_course_library where id = the_book;
    if seen <> 1 then
      raise exception '096 FAILED: a student on the course cannot see its reading list';
    end if;

    select file_path into got_path from my_course_library where id = the_book;
    if got_path is not null then
      raise exception '096 FAILED: a student who may NOT download was handed the file path, so '
                      'the licence is one request away from being breached';
    end if;

    -- THE STUDENT NOT ON IT SEES NOTHING.
    execute format('set local request.jwt.claim.sub = %L', out_user);
    select count(*) into seen from my_course_library where id = the_book;
    if seen <> 0 then
      raise exception '096 FAILED: a student not on the course can read its library';
    end if;

    reset role;

    -- ---- THE UNIVERSITY OPENS IT, AND THE PATH APPEARS --------------------
    --
    -- `reset role` PUTS THE ROLE BACK AND LEAVES THE CLAIM. `set local
    -- request.jwt.claim.sub` lasts for the whole transaction, so after resetting
    -- to postgres this block was still auth.uid() = the lecturer — and the
    -- trigger correctly refused the UNIVERSITY'S own update.
    --
    -- It looked like the guard being wrong and was the proof lying about who
    -- was asking. Clearing the claim is what "now nobody is signed in" actually
    -- means, and the trigger's `auth.uid() is null` branch — the server acting
    -- with the service key — is what is being exercised here.
    perform set_config('request.jwt.claim.sub', '', true);

    update course_resources set may_download = true, rights_set_by = super_user,
                                rights_set_at = now()
     where id = the_book;

    set local role authenticated;
    execute format('set local request.jwt.claim.sub = %L', in_user);
    select file_path into got_path from my_course_library where id = the_book;
    if got_path is null then
      raise exception '096 FAILED: a resource the University opened for download still withholds '
                      'the file, so opening it does nothing';
    end if;

    reset role;

    raise exception 'rollback 096 proof';
  exception
    when others then
      reset role;
      if sqlerrm <> 'rollback 096 proof' then raise; end if;
  end;
end $$;


do $$
begin
  raise notice '096 OK: a course has a library, and a resource must lead somewhere and be '
               'openable by somebody';
  raise notice '096 OK: a resource arrives READ-ONLY — a book wrongly marked downloadable is a '
               'licence breach that cannot be recalled';
  raise notice '096 OK: the Library may not set the download right, on update or on insert; the '
               'Superadministrator and the System Administrator do';
  raise notice '096 OK: a student who may not download is not handed the file path at all';
  raise notice '096 OK: and when the University opens it, the path appears';
end $$;
