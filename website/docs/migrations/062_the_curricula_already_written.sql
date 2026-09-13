-- ===========================================================================
-- 062 — THE CURRICULA THE UNIVERSITY HAS ALREADY WRITTEN
-- ===========================================================================
--
-- GENERATED FILE. DO NOT EDIT.
--   Generator: scripts/build-curriculum-seed.mjs
--   Source:    src/content/programmeCourses.ts
--
-- WHAT CHANGES FOR THE UNIVERSITY THE MOMENT THIS RUNS
--
-- 3 PROGRAMMES GET A REAL CURRICULUM — course by course, placed in the
-- year and semester the University wrote them into:
--
--   Bachelor of Theology     36 courses · 3 years · 6 semesters · 180 credits
--   Bachelor of Ministry     34 courses · 3 years · 6 semesters · 180 credits
--   Diploma of Theology      15 courses · 1 years · 2 semesters · 120 credits  (credit DERIVED: 120 / 15 = 8 each)
--
-- 061 built the shelf. This is the first thing on it, and it is the first
-- curriculum in this system that can be counted rather than read.
--
-- THE ENTRIES ATTACH TO A DRAFT VERSION and stay there. A curriculum becomes
-- the University's when the Vice-Chancellor approves it (058); 057 freezes it
-- at that moment, so this seeding could not have run afterwards.
--
-- ===========================================================================

-- ===========================================================================
-- 1. THE COURSES THEMSELVES
-- ===========================================================================
--
-- Most of these are not rows yet. `courses.credit_unit` is NOT NULL and
-- defaults to 3, so every insert below states the credit explicitly — a
-- default silently standing in for a value nobody wrote is how a curriculum
-- ends up adding to the wrong number.

-- Bachelor of Theology
insert into courses (code, title, credit_unit, credit_system)
values ('BIS 210', 'Introduction to Biblical Studies', 6, 'credit_hour')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('BIS 220', 'Bible Survey I', 3, 'credit_hour')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('BIS 230', 'Bible Survey II', 3, 'credit_hour')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('BIS 250', 'Bible Doctrine I', 3, 'credit_hour')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('MW 300', 'Evangelism and Missions Introduction', 5, 'credit_hour')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('OTH 300', 'Old Testament History and Theology', 5, 'credit_hour')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('CH 200', 'Introduction to Church History', 5, 'credit_hour')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('LC 110', 'Christology I', 5, 'credit_hour')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('OT 300', 'Pentateuch Studies', 5, 'credit_hour')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('MDS 720', 'Christian Psychology and Human Relations', 5, 'credit_hour')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('CH 300', 'Advanced Church History', 5, 'credit_hour')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('MDS 660', 'Christian Ethics', 5, 'credit_hour')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('CED 160', 'Christian Education', 5, 'credit_hour')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('BIS 330', 'Hermeneutics and Biblical Interpretation', 5, 'credit_hour')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('BIS 320', 'Homiletics I', 5, 'credit_hour')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('BL 340', 'Epistles Studies', 5, 'credit_hour')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('STT 410', 'Pneumatology', 5, 'credit_hour')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('MDS 650', 'Spiritual Leadership', 5, 'credit_hour')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('BIS 270', 'Introduction to Biblical Hebrew', 5, 'credit_hour')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('BIS 260', 'Bible Doctrine II', 3, 'credit_hour')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('RM 540', 'Research Methodology I', 3, 'credit_hour')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('STT 400', 'Systematic Theology I', 3, 'credit_hour')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('RM 550', 'Research Methodology II', 3, 'credit_hour')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('STT 420', 'Systematic Theology II', 3, 'credit_hour')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('BIS 280', 'Introduction to New Testament Greek', 5, 'credit_hour')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('MDS 670', 'Spiritual Formation', 5, 'credit_hour')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('MDS 730', 'Family Theology and Marriage Studies', 5, 'credit_hour')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('BIS 350', 'Advanced Hermeneutics', 5, 'credit_hour')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('CDS 100', 'Acts and Apostolic Mission', 5, 'credit_hour')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('MW 350', 'Missiology and Global Christianity', 5, 'credit_hour')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('MDS 820', 'ICT, Technology and Global Ministry', 5, 'credit_hour')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('BIS 340', 'Advanced Homiletics', 5, 'credit_hour')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('MDS 760', 'Spiritual Warfare and Demonology', 5, 'credit_hour')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('STT 430', 'African Theology and Contextual Theology', 5, 'credit_hour')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('STT 450', 'Ecotheology and Creation Care', 5, 'credit_hour')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('RM 560', 'Bachelor Thesis and Defense', 20, 'credit_hour')
on conflict (code) do nothing;

-- Bachelor of Ministry
insert into courses (code, title, credit_unit, credit_system)
values ('MIN 101', 'Introduction to Christian Ministry', 5, 'ECTS')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('BIB 101', 'Old Testament Survey', 5, 'ECTS')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('BIB 102', 'New Testament Survey', 5, 'ECTS')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('THE 101', 'Introduction to Christian Doctrine', 5, 'ECTS')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('SFM 101', 'Spiritual Formation and Christian Character', 5, 'ECTS')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('COM 101', 'Communication for Ministry', 5, 'ECTS')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('BIB 103', 'Biblical Interpretation and Hermeneutics', 5, 'ECTS')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('THE 102', 'Theology of Yahuah, Yahusha and the Ruach HaQodesh', 5, 'ECTS')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('BIB 104', 'Life and Ministry of Yahusha the Messiah', 5, 'ECTS')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('MIN 102', 'Prayer, Worship and Spiritual Disciplines', 5, 'ECTS')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('HIS 101', 'Church History I', 5, 'ECTS')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('MIN 103', 'Introduction to Preaching and Teaching', 5, 'ECTS')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('MIN 201', 'Five-Fold Ministry', 5, 'ECTS')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('MIN 202', 'Pastoral Ministry and Shepherding', 5, 'ECTS')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('EVG 201', 'Evangelism and Discipleship', 5, 'ECTS')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('THE 201', 'Theology of the Church', 5, 'ECTS')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('LEA 201', 'Christian Leadership', 5, 'ECTS')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('MUS 201', 'Worship and Music Ministry', 5, 'ECTS')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('MIN 203', 'Apostolic Leadership and Church Planting', 5, 'ECTS')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('MIN 204', 'Prophetic Ministry and Spiritual Discernment', 5, 'ECTS')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('MIN 205', 'Christian Education and Discipleship', 5, 'ECTS')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('PAS 201', 'Pastoral Care and Christian Counseling', 5, 'ECTS')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('ADM 201', 'Church Administration and Management', 5, 'ECTS')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('FIN 201', 'Christian Finance and Stewardship', 5, 'ECTS')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('MIS 301', 'Missions and Cross-Cultural Ministry', 5, 'ECTS')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('COM 301', 'Christian Media and Communications', 5, 'ECTS')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('ITM 301', 'Information Technology for Ministry', 5, 'ECTS')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('YTH 301', 'Youth and Children’s Ministry', 5, 'ECTS')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('COM 302', 'Community Development and Social Ministry', 5, 'ECTS')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('RES 301', 'Research Methods for Ministry', 5, 'ECTS')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('MIN 306', 'Advanced Ministry Leadership', 5, 'ECTS')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('MIN 307', 'Ministry Ethics, Governance and Accountability', 5, 'ECTS')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('MIN 308', 'Ministry Practicum', 10, 'ECTS')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('RES 302', 'Bachelor Ministry Research Project', 10, 'ECTS')
on conflict (code) do nothing;

-- Diploma of Theology
-- EVERY CREDIT BELOW IS 8, AND NOT ONE OF THEM WAS WRITTEN BY THE
-- UNIVERSITY. The award is ruled at 120 credits and 15 courses
-- are named for it; 120 / 15 is 8 exactly. The
-- assumption is that these carry equal weight. Where they do not, edit the
-- entry credits in the Curriculum Builder — the total is checked against the
-- programme's own figure on every change, so an uneven split still has to
-- add to 120.
insert into courses (code, title, credit_unit, credit_system)
values ('MA 210', 'Use of English', 8, 'credit_hour')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('BL 300', 'Epistle I', 8, 'credit_hour')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('CED 180', 'Soteriology I', 8, 'credit_hour')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('MDS 640', 'Ministerial Ethics', 8, 'credit_hour')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('NT 330', 'Romans', 8, 'credit_hour')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('BL 160', 'Tabernacle', 8, 'credit_hour')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('MDS 880', 'Faith', 8, 'credit_hour')
on conflict (code) do nothing;


-- ===========================================================================
-- 2. AND WHERE EACH ONE SITS
-- ===========================================================================
--
-- Year, semester and requirement belong HERE and not on the course — the
-- same course may sit differently in another programme, which is the whole
-- reason 057 put them on the entry.
--
-- Every entry is `core`: neither curriculum marks anything elective, and
-- inventing an elective would change what a student must pass.

do $$
declare
  v_id uuid;
  c_id uuid;
begin
  -- ---- Bachelor of Theology ----
  select v.id into v_id from programme_versions v
    join programmes p on p.id = v.programme_id
   where p.code = 'bachelor-of-theology' order by v.effective_from desc limit 1;
  if v_id is null then
    raise exception 'No version of bachelor-of-theology exists. 061 creates one; run it first.'
      using errcode = 'no_data_found';
  end if;

  select id into c_id from courses where code = 'BIS 210';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 1, 1, 'core', 6)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'BIS 220';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 1, 1, 'core', 3)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'BIS 230';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 1, 1, 'core', 3)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'BIS 250';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 1, 1, 'core', 3)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'MW 300';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 1, 1, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'OTH 300';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 1, 1, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'CH 200';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 1, 1, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'LC 110';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 1, 2, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'OT 300';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 1, 2, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'MDS 720';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 1, 2, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'CH 300';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 1, 2, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'MDS 660';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 1, 2, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'CED 160';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 1, 2, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'BIS 330';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 2, 1, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'BIS 320';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 2, 1, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'BL 340';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 2, 1, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'STT 410';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 2, 1, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'MDS 650';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 2, 1, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'BIS 270';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 2, 1, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'BIS 260';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 2, 2, 'core', 3)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'RM 540';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 2, 2, 'core', 3)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'STT 400';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 2, 2, 'core', 3)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'RM 550';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 2, 2, 'core', 3)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'STT 420';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 2, 2, 'core', 3)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'BIS 280';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 2, 2, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'MDS 670';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 2, 2, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'MDS 730';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 2, 2, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'BIS 350';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 3, 1, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'CDS 100';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 3, 1, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'MW 350';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 3, 1, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'MDS 820';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 3, 1, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'BIS 340';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 3, 1, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'MDS 760';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 3, 1, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'STT 430';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 3, 2, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'STT 450';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 3, 2, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'RM 560';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 3, 2, 'core', 20)
  on conflict (programme_version_id, course_id) do nothing;

  -- ---- Bachelor of Ministry ----
  select v.id into v_id from programme_versions v
    join programmes p on p.id = v.programme_id
   where p.code = 'bachelor-of-ministry' order by v.effective_from desc limit 1;
  if v_id is null then
    raise exception 'No version of bachelor-of-ministry exists. 061 creates one; run it first.'
      using errcode = 'no_data_found';
  end if;

  select id into c_id from courses where code = 'MIN 101';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 1, 1, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'BIB 101';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 1, 1, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'BIB 102';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 1, 1, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'THE 101';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 1, 1, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'SFM 101';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 1, 1, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'COM 101';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 1, 1, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'BIB 103';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 1, 2, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'THE 102';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 1, 2, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'BIB 104';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 1, 2, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'MIN 102';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 1, 2, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'HIS 101';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 1, 2, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'MIN 103';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 1, 2, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'MIN 201';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 2, 1, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'MIN 202';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 2, 1, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'EVG 201';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 2, 1, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'THE 201';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 2, 1, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'LEA 201';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 2, 1, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'MUS 201';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 2, 1, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'MIN 203';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 2, 2, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'MIN 204';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 2, 2, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'MIN 205';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 2, 2, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'PAS 201';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 2, 2, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'ADM 201';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 2, 2, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'FIN 201';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 2, 2, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'MIS 301';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 3, 1, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'COM 301';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 3, 1, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'ITM 301';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 3, 1, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'YTH 301';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 3, 1, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'COM 302';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 3, 1, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'RES 301';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 3, 1, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'MIN 306';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 3, 2, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'MIN 307';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 3, 2, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'MIN 308';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 3, 2, 'core', 10)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'RES 302';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 3, 2, 'core', 10)
  on conflict (programme_version_id, course_id) do nothing;

  -- ---- Diploma of Theology ----
  select v.id into v_id from programme_versions v
    join programmes p on p.id = v.programme_id
   where p.code = 'diploma-in-theology' order by v.effective_from desc limit 1;
  if v_id is null then
    raise exception 'No version of diploma-in-theology exists. 061 creates one; run it first.'
      using errcode = 'no_data_found';
  end if;

  select id into c_id from courses where code = 'BIS 250';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 1, 1, 'core', 8)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'MW 300';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 1, 1, 'core', 8)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'CH 200';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 1, 1, 'core', 8)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'MA 210';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 1, 1, 'core', 8)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'OTH 300';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 1, 1, 'core', 8)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'LC 110';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 1, 1, 'core', 8)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'MDS 760';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 1, 2, 'core', 8)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'MW 350';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 1, 2, 'core', 8)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'BL 300';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 1, 2, 'core', 8)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'CED 180';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 1, 2, 'core', 8)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'MDS 640';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 1, 2, 'core', 8)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'NT 330';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 1, 2, 'core', 8)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'OT 300';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 1, 2, 'core', 8)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'BL 160';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 1, 2, 'core', 8)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'MDS 880';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 1, 2, 'core', 8)
  on conflict (programme_version_id, course_id) do nothing;

end $$;


-- ===========================================================================
-- 3. WHAT A CURRICULUM ADDS UP TO, DRAFT OR NOT
-- ===========================================================================
--
-- `programme_in_force` answers "what is this programme" and joins only the
-- PUBLISHED version — right for a prospectus, useless for the Curriculum
-- Builder, which works on a DRAFT and needs its running total on every edit.
--
-- A draft is the only time the total matters. Once a version is published it
-- is frozen and its arithmetic cannot change; while it is a draft the gap
-- between what the courses add to and what the programme claims IS the work
-- remaining, and it is what the Academic Dashboard means by
-- "programme/curriculum issues".

create or replace view curriculum_progress
with (security_invoker = true) as
select v.id                as version_id,
       v.programme_id,
       p.code,
       p.award_level,
       v.version_label,
       v.status,
       v.duration_years,
       v.semesters_per_year,
       v.total_credits,
       (select count(*) from curriculum_entries e
         where e.programme_version_id = v.id)            as courses_in_curriculum,
       (select coalesce(sum(coalesce(e.credits, c.credit_unit)), 0)
          from curriculum_entries e join courses c on c.id = e.course_id
         where e.programme_version_id = v.id)            as credits_in_curriculum,
       -- THE GAP, SIGNED. Negative is short, positive is over, zero is done.
       (select coalesce(sum(coalesce(e.credits, c.credit_unit)), 0)
          from curriculum_entries e join courses c on c.id = e.course_id
         where e.programme_version_id = v.id) - coalesce(v.total_credits, 0)
                                                        as credits_against_claim,
       -- AND WHETHER EVERY TERM THE PROGRAMME RUNS HAS ANYTHING IN IT. A
       -- curriculum can add to exactly 180 and still have an empty semester.
       (select count(distinct (e.year, e.semester)) from curriculum_entries e
         where e.programme_version_id = v.id)            as terms_with_courses,
       v.duration_years * v.semesters_per_year           as terms_expected
  from programme_versions v
  join programmes p on p.id = v.programme_id;

comment on view curriculum_progress is
  'Every programme version, published or draft, with what its curriculum actually adds up to '
  'against what the programme claims. `programme_in_force` shows only published versions; the '
  'Curriculum Builder works on drafts, which is the only time the total can still change.';


-- ===========================================================================
-- 4. PROVE IT
-- ===========================================================================

do $$
declare n integer; total integer;
begin
  -- Bachelor of Theology: 36 courses, 180 credits
  select count(*), coalesce(sum(e.credits), 0) into n, total
    from curriculum_entries e
    join programme_versions v on v.id = e.programme_version_id
    join programmes p on p.id = v.programme_id
   where p.code = 'bachelor-of-theology';
  if n <> 36 then
    raise exception '062 FAILED: bachelor-of-theology has % entries, expected 36', n;
  end if;
  if total <> 180 then
    raise exception '062 FAILED: bachelor-of-theology adds up to %, not 180', total;
  end if;

  -- Bachelor of Ministry: 34 courses, 180 credits
  select count(*), coalesce(sum(e.credits), 0) into n, total
    from curriculum_entries e
    join programme_versions v on v.id = e.programme_version_id
    join programmes p on p.id = v.programme_id
   where p.code = 'bachelor-of-ministry';
  if n <> 34 then
    raise exception '062 FAILED: bachelor-of-ministry has % entries, expected 34', n;
  end if;
  if total <> 180 then
    raise exception '062 FAILED: bachelor-of-ministry adds up to %, not 180', total;
  end if;

  -- Diploma of Theology: 15 courses, 120 credits
  select count(*), coalesce(sum(e.credits), 0) into n, total
    from curriculum_entries e
    join programme_versions v on v.id = e.programme_version_id
    join programmes p on p.id = v.programme_id
   where p.code = 'diploma-in-theology';
  if n <> 15 then
    raise exception '062 FAILED: diploma-in-theology has % entries, expected 15', n;
  end if;
  if total <> 120 then
    raise exception '062 FAILED: diploma-in-theology adds up to %, not 120', total;
  end if;

  -- THE CURRICULUM MATCHES WHAT THE PROGRAMME CLAIMS. This is the check the
  -- Curriculum Builder will make on every edit, made once here: a version
  -- claiming 180 credits whose courses add to 174 is a curriculum nobody can
  -- graduate from, and it would be found by a student rather than by this.
  --
  -- READ FROM `curriculum_progress`, NOT `programme_in_force`. This check was
  -- written against the latter and PASSED WITHOUT TESTING ANYTHING: that view
  -- joins only PUBLISHED versions, every version here is a draft, so it
  -- returned no rows and the count was 0. A proof that cannot see the thing
  -- it is checking always passes. Section 5 adds the view that can.
  select count(*) into n from curriculum_progress
   where courses_in_curriculum > 0
     and total_credits is not null
     and credits_in_curriculum <> total_credits;
  if n > 0 then
    raise exception '062 FAILED: % curricula do not add up to what their programme claims', n;
  end if;

  -- AND IT SAW THEM. The assertion above is only worth having if the view
  -- returned the curricula this file just seeded.
  select count(*) into n from curriculum_progress where courses_in_curriculum > 0;
  if n <> 3 then
    raise exception '062 FAILED: the totals view sees % curricula, not the 3 just seeded', n;
  end if;

  -- AND NOTHING WAS APPROVED ON THE WAY IN.
  select count(*) into n from programme_versions where status <> 'draft';
  if n > 0 then
    raise exception '062 FAILED: % versions are no longer drafts', n;
  end if;

  raise notice '062 OK: 3 curricula moved into rows, course by course, each adding up to exactly what its programme claims';
  raise notice '062 OK: every entry is core, every version is still a draft, and nothing was approved on the way in';
end $$;


-- ===========================================================================
-- 5. VERIFY — READ THIS OUTPUT
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- WHAT EACH PROGRAMME NOW HAS. `credits_in_curriculum` against
-- `total_credits` is the Curriculum Builder's running total: equal means the
-- curriculum is complete, 0 means the shelf is still empty.
-- ---------------------------------------------------------------------------
select code, award_level, status, duration_years as yrs,
       courses_in_curriculum as courses, credits_in_curriculum as credits,
       total_credits as claims, credits_against_claim as gap,
       terms_with_courses || ' of ' || terms_expected as terms_filled
  from curriculum_progress
 order by courses_in_curriculum desc, code
 limit 10;
