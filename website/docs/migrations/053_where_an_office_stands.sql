-- ===========================================================================
-- 053 — WHERE AN OFFICE STANDS, AND THE OFFICE THAT WAS CALLED THREE THINGS
-- ===========================================================================
--
-- WHAT CHANGES FOR THE UNIVERSITY THE MOMENT THIS RUNS
--
-- 1. THE APPOINTMENT LETTER STARTS SAYING DIFFERENT THINGS TO DIFFERENT
--    OFFICES. It already did in the code; this is the data that feeds it. A
--    post's `family` selects the register of wording — a Dean's letter, a
--    Lecturer's and the Director of Academic Affairs' stop being the same
--    generic executive letter with a different job title in it.
--
-- 2. THE DIRECTOR OF ACADEMIC AFFAIRS IS RECORDED AS RANKING IMMEDIATELY BELOW
--    THE VICE-CHANCELLOR. The University stated this on 13 September 2026. It
--    is stored on the post, and it is the ONLY post that carries it — so the
--    sentence can be printed where it is true and nowhere else.
--
--    A LETTER THAT CLAIMS A RANK IS MAKING A CONSTITUTIONAL CLAIM. If that
--    sentence lived in a template, every future template copying it would
--    repeat the claim for whatever post it was pointed at, and a Lecturer's
--    letter would quietly say the same thing. As a column on one row it cannot.
--
-- 3. NOTHING IS GRANTED. `precedence` and `standing` say where an office sits.
--    They say nothing about what it may authorise, may recommend or must
--    escalate — those three are in the job description, which 048 versions and
--    approves separately, and this migration does not touch them.
--
-- ---------------------------------------------------------------------------
-- AND IT DOES NOT RENAME ANYTHING
-- ---------------------------------------------------------------------------
--
-- The University has ruled that the office called "Head of Academic Affairs" in
-- this system and "Academic Director General" on the published About page is
-- the DIRECTOR OF ACADEMIC AFFAIRS. 048 already seeded the post under that
-- name, so there is no row here to rename — the disagreement was in the
-- application's own constants and in the website's content, and both are fixed
-- in the same change as this file. It is recorded here because somebody reading
-- the migrations in five years will want to know when the three names became
-- one.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. WHERE AN OFFICE STANDS
-- ---------------------------------------------------------------------------

alter table positions
  add column if not exists executive_level text,
  -- The rank, as it is printed in a table cell: "Second-ranking officer after
  -- the Vice-Chancellor".
  add column if not exists precedence      text,
  -- The same standing, as a sentence in a paragraph. TWO COLUMNS ON PURPOSE:
  -- lowercasing the first to make the second produced "The office of Director
  -- of Academic Affairs is second-ranking officer after the Vice-Chancellor",
  -- which is neither a rank nor English.
  add column if not exists standing        text;

comment on column positions.executive_level is
  'The management band the office sits in, where the University has recorded one. Printed in '
  'the appointment letter''s details table. Never derived.';

comment on column positions.precedence is
  'Where the office ranks, as a table-cell value. Printed ONLY for posts that carry it, so a '
  'letter cannot claim a standing the University has not stated for that post.';

comment on column positions.standing is
  'The same fact as a sentence, for the letter''s opening paragraphs. Says where the office '
  'sits and NOT what it may do — authority is in the job description and nowhere else.';

-- NOT A FREE-TEXT INVITATION. A standing is a considered statement about the
-- University's structure, and a one-word value in it is a typo rather than a
-- ruling.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'positions_standing_is_a_statement') then
    alter table positions add constraint positions_standing_is_a_statement
      check (standing is null or length(btrim(standing)) >= 20);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'positions_precedence_is_a_rank') then
    alter table positions add constraint positions_precedence_is_a_rank
      check (precedence is null or length(btrim(precedence)) >= 8);
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. THE ONE POST THE UNIVERSITY HAS RANKED
-- ---------------------------------------------------------------------------
--
-- WRITTEN ONLY WHERE IT IS STILL EMPTY. If the University has since edited
-- either field, this must not put its own wording back on a re-run — a
-- migration that overwrites a considered change is a migration nobody can run
-- twice.

update positions
   set executive_level = coalesce(executive_level, 'Senior Executive Management'),
       precedence      = coalesce(precedence, 'Second-ranking officer after the Vice-Chancellor'),
       standing        = coalesce(standing,
                                  'a senior executive office of the University, ranking '
                                  'immediately below the Vice-Chancellor in the University''s '
                                  'executive structure')
 where job_code = 'ACA-DAA';

-- ---------------------------------------------------------------------------
-- 3. PROVE IT
-- ---------------------------------------------------------------------------

do $$
declare
  ranked  int;
  daa     record;
  refused boolean;
begin
  -- ---- ONE POST CARRIES A RANK, AND ONLY ONE ------------------------------
  select count(*) into ranked from positions where precedence is not null;
  if ranked <> 1 then
    raise exception '053 FAILED: % posts carry a precedence, expected exactly 1', ranked;
  end if;

  select job_code, precedence, standing, executive_level, family
    into daa from positions where job_code = 'ACA-DAA';

  if daa is null then
    raise exception '053 FAILED: ACA-DAA is not in the register — run 048 first';
  end if;
  if daa.precedence is null or daa.standing is null then
    raise exception '053 FAILED: the Director of Academic Affairs carries no standing';
  end if;
  if daa.family <> 'academic-administration' then
    raise exception '053 FAILED: ACA-DAA is in family %, so it would take the wrong register',
                    daa.family;
  end if;

  -- ---- EVERY POST HAS A FAMILY, because the family picks the wording ------
  -- A post with none falls to the plainest register rather than the grandest,
  -- which is safe — but a post with no family at all is a post nobody
  -- classified, and the letter it produces is nobody's decision.
  if exists (select 1 from positions where family is null or btrim(family) = '') then
    raise exception '053 FAILED: some posts have no family, so their letters have no register';
  end if;

  -- ---- AND THE GUARDS REFUSE ---------------------------------------------
  begin
    refused := false;
    begin
      update positions set standing = 'senior' where job_code = 'ACA-DAA';
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '053 FAILED: a one-word standing was accepted as a statement of structure';
    end if;

    refused := false;
    begin
      update positions set precedence = 'top' where job_code = 'ACA-DAA';
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '053 FAILED: a three-letter precedence was accepted as a rank';
    end if;

    raise exception 'PROOF_ROLLBACK';
  exception
    when others then
      if sqlerrm <> 'PROOF_ROLLBACK' then raise; end if;
  end;

  raise notice '053 OK: every post carries a family, so every appointment letter has a register '
               'of wording appropriate to the office';
  raise notice '053 OK: the Director of Academic Affairs ranks immediately below the '
               'Vice-Chancellor, and is the only post that carries a standing';
  raise notice '053 OK: a standing too short to be a statement is refused';
end $$;


-- ===========================================================================
-- 4. VERIFY — READ THIS OUTPUT
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- WHICH REGISTER EACH KIND OF OFFICE WILL TAKE, and which posts the University
-- has ranked. Every family below should have posts in it; only ACA-DAA should
-- show a precedence.
-- ---------------------------------------------------------------------------
select family,
       count(*)                                        as posts,
       count(*) filter (where precedence is not null)  as ranked,
       string_agg(job_code, ', ' order by job_code)
         filter (where precedence is not null)         as which
  from positions
 group by family
 order by family;
