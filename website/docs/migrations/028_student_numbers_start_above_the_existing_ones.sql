-- ===========================================================================
-- 028 — A RESERVED STUDENT NUMBER MUST NOT BE ONE ALREADY ISSUED
--
-- Run after 027. Idempotent; destroys nothing. Safe on a live database.
--
-- ---------------------------------------------------------------------------
-- WHY — AN ADMISSION THAT COULD NOT COMPLETE
-- ---------------------------------------------------------------------------
--
-- The University retried an issuance and it refused:
--
--   duplicate key value violates unique constraint "students_student_number_key"
--
-- reserve_student_number() keeps a counter per intake year in
-- student_number_counters, and for a year it has not seen before it starts
-- that counter at 1. It never looked at the numbers already in `students`.
--
-- Every student admitted before 024 was numbered the old way — read the
-- highest existing number for the year and add one — so by the time the
-- counter was introduced, 2026 already had students holding ICOF202600001 and
-- upwards. The first reservation of the new scheme therefore handed back a
-- number that was already on somebody's record, and the unique index correctly
-- refused it.
--
-- IT WOULD HAVE HAPPENED TO EVERY DEPLOYMENT WITH EXISTING STUDENTS, on the
-- first admission after 024, for every intake year already in use. It is not
-- specific to one application.
--
-- ---------------------------------------------------------------------------
-- WHAT CHANGES
-- ---------------------------------------------------------------------------
--
-- The counter is seeded from, and can never fall behind, the highest number
-- actually issued for that year. Two guards rather than one:
--
--   ON FIRST USE for a year, it starts above the highest existing number
--   instead of at 1.
--
--   ON EVERY USE, it takes the greater of its own counter and the highest
--   existing number. A counter that has drifted behind — because somebody
--   inserted a student by hand, or restored a backup, or ran the old code
--   path once more — corrects itself rather than colliding.
--
-- ONLY WELL-FORMED NUMBERS COUNT. The scan matches ICOF<year> followed by
-- digits and nothing else, so a legacy number in some other shape cannot make
-- the arithmetic fail. It is ignored, and the unique index remains the
-- backstop it always was.
--
-- THE CONCURRENCY PROPERTY 024 ADDED IS KEPT. The reservation is still a
-- single INSERT ... ON CONFLICT DO UPDATE ... RETURNING, so two approvals in
-- the same millisecond still take the row lock in turn and receive different
-- numbers. That was the whole point of the counter and it is not given up to
-- fix this.
-- ===========================================================================


-- ===========================================================================
-- 1. THE FUNCTION
-- ===========================================================================

create or replace function reserve_student_number(p_year integer) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  seq     integer;
  highest integer;
begin
  -- The highest number ALREADY ISSUED for this year, ignoring anything not in
  -- the ICOF<year><digits> shape. `substring(... from pattern)` returns the
  -- capture group, so this is the numeric tail and nothing else.
  select coalesce(max(substring(student_number from '^ICOF' || p_year::text || '([0-9]+)$')::integer), 0)
    into highest
    from students
   where student_number ~ ('^ICOF' || p_year::text || '[0-9]+$');

  -- `next_value` is the number to hand out next. On a first reservation for
  -- the year that is highest + 1, so the row is written one beyond it; on a
  -- later one the counter moves on, but never to below what has been issued.
  insert into student_number_counters (year, next_value)
  values (p_year, highest + 2)
  on conflict (year) do update
    set next_value = greatest(student_number_counters.next_value, highest + 1) + 1
  returning next_value - 1 into seq;

  return 'ICOF' || p_year::text || lpad(seq::text, 5, '0');
end;
$$;


-- ===========================================================================
-- 2. PERFORMING THE RULES
-- ===========================================================================

-- The proof runs inside a plpgsql sub-block, which is a savepoint: raising at
-- the end rolls every row below back and leaves nothing behind.

do $$
declare
  a text;
  b text;
  c text;
begin
 begin
  -- ---- THE EXACT FAILURE THE UNIVERSITY SAW --------------------------
  -- A student already holds the first number of the year, numbered the old
  -- way, and the counter has never been used for that year.
  insert into students (first_name, last_name, matric_no, email, student_number, status)
  values ('Proof', '028', 'PROOF-028-A', 'proof-028a@iguc.net', 'ICOF209900001', 'admission_issued');

  delete from student_number_counters where year = 2099;

  a := reserve_student_number(2099);
  if a = 'ICOF209900001' then
    raise exception '028 FAILED: reserved a number that was already issued (%)', a;
  end if;
  if a <> 'ICOF209900002' then
    raise exception '028 FAILED: expected ICOF209900002, got %', a;
  end if;

  -- And it is actually insertable, which is the only thing that matters.
  insert into students (first_name, last_name, matric_no, email, student_number, status)
  values ('Proof', '028', 'PROOF-028-B', 'proof-028b@iguc.net', a, 'admission_issued');

  -- ---- IT STILL COUNTS UP -------------------------------------------
  b := reserve_student_number(2099);
  if b <> 'ICOF209900003' then
    raise exception '028 FAILED: the counter did not advance, got %', b;
  end if;

  -- ---- A COUNTER THAT HAS DRIFTED BEHIND CORRECTS ITSELF -------------
  -- Somebody inserts a student by hand, well beyond the counter. The next
  -- reservation must step over them rather than collide.
  insert into students (first_name, last_name, matric_no, email, student_number, status)
  values ('Proof', '028', 'PROOF-028-C', 'proof-028c@iguc.net', 'ICOF209900050', 'admission_issued');

  c := reserve_student_number(2099);
  if c <> 'ICOF209900051' then
    raise exception '028 FAILED: a counter behind the register did not catch up, got %', c;
  end if;

  -- ---- A MALFORMED LEGACY NUMBER DOES NOT BREAK THE ARITHMETIC -------
  -- It is ignored rather than parsed. Before the pattern was anchored this
  -- raised invalid input syntax for integer and no number could be issued at
  -- all for the year.
  insert into students (first_name, last_name, matric_no, email, student_number, status)
  values ('Proof', '028', 'PROOF-028-D', 'proof-028d@iguc.net', 'ICOF2099/OLD/7', 'admission_issued');

  if reserve_student_number(2099) <> 'ICOF209900052' then
    raise exception '028 FAILED: a legacy number in another shape disturbed the sequence';
  end if;

  raise exception 'PROOF_ROLLBACK';
 exception when others then
   -- Anything that is not the sentinel is a real failure and must not be eaten.
   if sqlerrm <> 'PROOF_ROLLBACK' then raise; end if;
 end;

 raise notice '028 OK — a reserved number starts above every number already issued, keeps '
              'counting, catches up when the counter has drifted, and ignores legacy numbers '
              'in other shapes.';
end $$;


-- ===========================================================================
-- 3. VERIFY
-- ===========================================================================

-- What each intake year has issued, and what the counter believes comes next.
-- `next_to_issue` must be greater than `highest_issued` on every row. A row
-- where it is not is a year the next admission would collide on.
select
  y.year,
  c.next_value                                   as next_to_issue,
  (select max(substring(s.student_number from '^ICOF' || y.year::text || '([0-9]+)$')::integer)
     from students s
    where s.student_number ~ ('^ICOF' || y.year::text || '[0-9]+$')) as highest_issued
from (select distinct year from student_number_counters) y
left join student_number_counters c on c.year = y.year
order by y.year;
