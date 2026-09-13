-- ===========================================================================
-- MAKE A TEST DATABASE LOOK LIKE THE UNIVERSITY'S, BEFORE PROVING ANYTHING
-- ===========================================================================
--
-- ---------------------------------------------------------------------------
-- WHY THIS FILE EXISTS
-- ---------------------------------------------------------------------------
--
-- Every migration in this directory was proved against Postgres, twice, and
-- one of them still stopped the University's database dead:
--
--   ERROR: 23505: duplicate key value violates unique constraint
--          "document_templates_one_active_idx"
--   DETAIL: Key (kind)=(promotion) already exists.
--
-- Nothing was wrong with their database. The fault was in the PROOF. 044
-- activates a 'promotion' template to demonstrate that one version per kind
-- may be active — and the University had, quite properly, activated its own
-- promotion template through Settings. The proof and the University were
-- competing for the same slot, and the proof lost.
--
-- The reason three passes of the harness never saw it is that THE HARNESS
-- STARTS EMPTY. A clean database has no active templates, no activated job
-- descriptions, no conditions of appointment written for a particular post.
-- The University's has all three, and gets more of them every time they use
-- the system properly. So every one of those is a slot a proof can collide
-- with, and none of them existed in the place the proofs were being tested.
--
-- ---------------------------------------------------------------------------
-- THE RULE THIS ENFORCES
-- ---------------------------------------------------------------------------
--
-- A PROOF MUST NOT COMPETE FOR ANYTHING THE UNIVERSITY'S OWN DATA OCCUPIES.
-- Not a version number, not a reference, and not a unique slot like "the
-- active template of this kind" or "the active conditions for this post".
--
-- Where a proof genuinely needs the slot — 044 has to activate something to
-- show that activation works — it parks whatever is there FIRST, inside its
-- own rolled-back block. The University's row is back the moment the proof
-- ends, and the proof then tests what it claims rather than being satisfied
-- by a unique index refusing the write for an unrelated reason.
--
-- ---------------------------------------------------------------------------
-- HOW TO USE IT
-- ---------------------------------------------------------------------------
--
--   createdb mprod
--   psql -d mprod -f tests/supabase-stub.sql
--   psql -d mprod -f <migrations 001-035>
--   psql -d mprod -f RUN-PART-1.sql … RUN-PART-4.sql      # first landing
--   psql -d mprod -f tests/as-the-university-has-it.sql   # THIS FILE
--   psql -d mprod -f RUN-PART-1.sql … RUN-PART-4.sql      # must still be clean
--   psql -d mprod -f RUN-PART-1.sql … RUN-PART-4.sql      # and again
--
-- Run it AFTER the migrations have landed once, because it activates rows they
-- seed. Then run them again, twice. Anything that competes with the University
-- fails on that second landing, which is the run the University actually does.
--
-- IT ALSO CHECKS ITSELF at the end: the rows it activated must still be active
-- and unchanged after the migrations run over them, and no proof row may
-- survive. A proof that parks the University's data and forgets to roll back
-- would otherwise look exactly like success.
-- ===========================================================================

do $$
declare
  u1  uuid;
  u2  uuid;
  k   text;
  fam text;
  tid uuid;
begin
  select id into u1 from auth.users order by created_at limit 1;
  select id into u2 from auth.users where id <> u1 limit 1;
  if u1 is null or u2 is null then
    raise exception 'as-the-university-has-it: needs two accounts to activate anything, '
                    'because nobody activates what they wrote';
  end if;

  -- ---- TEMPLATES THE UNIVERSITY HAS PUT INTO FORCE ------------------------
  --
  -- These three are the kinds the proofs in 044, 051 and 052 activate. Any
  -- kind would do; these are the ones that have actually collided.
  -- EVERY KIND, NOT A SAMPLE. The University has put a template in force for
  -- every document it issues — which is precisely the work the coverage view
  -- exists to track to completion.
  --
  -- A SAMPLE OF THREE WAS NOT ENOUGH, AND THAT IS THE SECOND LESSON THIS FILE
  -- CARRIES. 051's proof asserted that SOMETHING was still uncovered, in its
  -- own words "which on a fresh database cannot be true" — so it failed the
  -- University for having finished the job. With three kinds activated here
  -- the assertion still held and the fault stayed hidden. It only appears on a
  -- database where the work is done.
  --
  -- RE-RUNNABLE: a kind already in force is skipped, so this file can be
  -- applied between landings without colliding with itself.
  if to_regclass('public.document_template_coverage') is not null then
    for k in select c.kind from document_template_coverage c
              where c.active_template_id is null loop
      select id into tid from document_templates
       where kind = k and status = 'draft' order by version limit 1;

      if tid is null then
        insert into document_templates (kind, version, name, body, status, created_by)
        values (k, coalesce((select max(version) from document_templates where kind = k), 0) + 1,
                'The University''s own ' || k,
                'A body long enough to pass the minimum length check.', 'draft', u1)
        returning id into tid;
      end if;

      update document_templates
         set status = 'active', activated_by = u2, activated_at = now(),
             effective_from = current_date
       where id = tid;
    end loop;
  end if;

  -- ---- JOB DESCRIPTIONS THE UNIVERSITY HAS ACTIVATED ----------------------
  --
  -- 048 seeds eight family profiles as drafts and the Job Descriptions screen
  -- activates them one click at a time. The moment it does, 048's own proof is
  -- working against a family that already has an active profile.
  -- ACTIVATED BY u1, NOT u2, AND THAT IS THE POINT. The seeded profiles have
  -- no author, so `second_pair_of_eyes` lets any account activate them — and
  -- the University's Superadministrator, the first account in the table, is
  -- who actually pressed the button.
  --
  -- That is exactly what broke 048 on their database. Its proof wrote the
  -- first account into `created_by` on the University's own row, which was
  -- already activated by that same account, making the author and the
  -- activator one person. Activating as u2 here hid the fault; activating as
  -- u1 reproduces it.
  -- ALL EIGHT, for the same reason every template kind is activated above: a
  -- sample leaves the state a proof assumes still partly true, and the fault
  -- hides until the University finishes the job.
  foreach fam in array array['executive', 'academic-administration',
                             'faculty-leadership', 'administration',
                             'student-services', 'ict', 'academic-staff', 'other'] loop
    update position_profiles
       set status = 'active', activated_by = u1, activated_at = now()
     where family = fam and position_id is null and status = 'draft'
       and job_purpose is not null;
  end loop;

  -- ---- A CERTIFICATE DESIGN THE UNIVERSITY HAS PUBLISHED ------------------
  --
  -- `credential_templates_one_active_per_type` is the last of the eleven
  -- one-active indexes in this schema that no test had ever occupied. The
  -- other ten are filled by the migrations themselves or by the blocks above,
  -- and every one of those has now been run over twice; this one was empty,
  -- so any proof that publishes a design had never met a University that
  -- already had one.
  if to_regclass('public.credential_templates') is not null
     and not exists (select 1 from credential_templates where is_active) then
    insert into credential_templates
      (kind, version, name, design, is_active, lifecycle, created_by, published_at)
    values ('certificate', 1, 'The University''s own certificate',
            '{}'::jsonb, true, 'published', u1, now());
  end if;

  -- ---- CONDITIONS WRITTEN FOR ONE POST ------------------------------------
  --
  -- 078's proof gives the Director of Academic Affairs its own conditions to
  -- show that a post's section replaces its family's. So does the University,
  -- the first time it uses the Conditions of appointment screen on that post.
  if to_regclass('public.appointment_condition_sets') is not null then
    select id into tid from positions where job_code = 'ACA-DAA';
    if tid is not null
       and not exists (select 1 from appointment_condition_sets
                        where position_id = tid and status = 'active') then
      insert into appointment_condition_sets
        (position_id, version, status, effective_from, created_by, activated_by, activated_at)
      values (tid, 1, 'active', current_date, u1, u2, now())
      returning id into tid;

      insert into appointment_condition_clauses (set_id, section, ordinal, body)
      values (tid, 'notice',
              1, 'Either party may end this appointment on three months'' written notice.');
    end if;
  end if;

  raise notice 'as-the-university-has-it: % template(s) and % job description(s) are now in '
               'force, as they are on the University''s own database. Run the migrations '
               'again, twice. Anything that competes with them will fail.',
    (select count(*) from document_templates where status = 'active'),
    (select count(*) from position_profiles where status = 'active');
end $$;


-- ===========================================================================
-- WHAT MUST STILL BE TRUE AFTERWARDS
-- ===========================================================================
--
-- Run this part again after the migrations, and read it. A proof that parked
-- the University's row and did not roll back leaves this showing the wrong
-- thing, and a proof that leaked a row shows up in the last count.

select 'active templates'  as what, count(*) as how_many
  from document_templates where status = 'active'
union all
select 'active job descriptions', count(*)
  from position_profiles where status = 'active'
union all
select 'THIS MUST BE ZERO — proof rows left behind', count(*)
  from document_templates where version >= 9000;
