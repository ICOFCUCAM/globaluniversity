-- ===========================================================================
-- 060 — THE SCHOOLS AND PROGRAMMES
-- ===========================================================================
--
-- GENERATED FILE. DO NOT EDIT.
--   Generator: scripts/build-academic-seed.mjs
--   Source:    src/content/programmeCatalogue.ts
--
-- WHAT CHANGES FOR THE UNIVERSITY THE MOMENT THIS RUNS
--
-- THE REGISTER STOPS BEING EMPTY. 5 schools and 41 programmes
-- become rows, moved out of the TypeScript the website compiles them from and
-- into tables the Superadministrator can manage.
--
-- NOTHING IS OPENED. Every programme arrives as a draft. 023 ruled that
-- admission is opt-in, and 057 refuses to open a programme with no published
-- curriculum in any case.
--
-- NO CURRICULUM IS SEEDED, and no duration. See the closing report: the
-- University has ruled the length of 14 of these
-- 41 programmes and published a RANGE for the other 27.
-- "One to two academic years" is not a duration, and writing 1 or 2 into
-- `duration_years` would be inventing the length of a degree.
-- ===========================================================================


-- ===========================================================================
-- 1. THE SCHOOLS
-- ===========================================================================
--
-- Five, as the University publishes on its About page. `faculties.ts` lists
-- six because it separates the School of Ministry at Douala; the About page
-- names five and that is what is seeded.

insert into schools (code, name, mission, status)
values ('theology', 'Faculty of Theology', 'Preparing Christian leaders, ministers, missionaries and theologians for service throughout Africa and the world.', 'active')
on conflict (code) do nothing;

insert into schools (code, name, mission, status)
values ('engineering', 'Faculty of Engineering and Technology', 'Building practitioners who can design, install, maintain and secure the systems modern work depends on — in African economies and in the international market their skills travel to.', 'active')
on conflict (code) do nothing;

-- PUBLISHED NAME, not the catalogue's. programmeCatalogue.ts calls this
-- "Faculty of Business Management Science and Administration", which appears nowhere else and which the About page
-- contradicts.
insert into schools (code, name, mission, status)
values ('business', 'Global Institute of Business and Management Science', 'Training ethical administrators, accountants and managers for enterprise, government and the not-for-profit sector, in Africa and wherever our graduates are called to serve.', 'active')
on conflict (code) do nothing;

insert into schools (code, name, mission, status)
values ('ministry', 'School of Ministry', 'Forming pastors, evangelists and church leaders for the work itself — the congregation, the mission field and the organisation that carries them.', 'active')
on conflict (code) do nothing;

insert into schools (code, name, mission, status)
values ('education', 'Faculty of Education', 'Forming teachers who can hold a classroom and reach the child in it — for schools across Africa and for the diaspora communities that share them.', 'active')
on conflict (code) do nothing;


-- ===========================================================================
-- 2. THE PROGRAMMES
-- ===========================================================================
--
-- The code is the slug the site already uses in every programme URL and in
-- `courses.programme_slug`, so the register joins to both without
-- translation. Nothing here is abbreviated or invented.
--
-- `status` is 'draft' for every one of them. Opening a programme for
-- admission is a decision, and 057 will refuse it until a curriculum has
-- been approved.

do $$
declare
  s_id uuid;
begin
  select id into s_id from schools where code = 'theology';
  insert into programmes (code, award_level, status)
  values ('diploma-in-theology', 'Diploma', 'draft')
  on conflict (code) do nothing;
  -- Diploma in Theology · 120 credits · One to two academic years

  select id into s_id from schools where code = 'ministry';
  insert into programmes (code, award_level, status)
  values ('diploma-in-ministry', 'Diploma', 'draft')
  on conflict (code) do nothing;
  -- Diploma in Ministry · 120 credits · One to two academic years

  select id into s_id from schools where code = 'ministry';
  insert into programmes (code, award_level, status)
  values ('diploma-in-christian-leadership', 'Diploma', 'draft')
  on conflict (code) do nothing;
  -- Diploma in Christian Leadership · 120 credits · One to two academic years

  select id into s_id from schools where code = 'engineering';
  insert into programmes (code, award_level, status)
  values ('diploma-in-computer-networking', 'Diploma', 'draft')
  on conflict (code) do nothing;
  -- Diploma in Computer Networking · 120 credits · One to two academic years

  select id into s_id from schools where code = 'engineering';
  insert into programmes (code, award_level, status)
  values ('diploma-in-software-engineering', 'Diploma', 'draft')
  on conflict (code) do nothing;
  -- Diploma in Software Engineering · 120 credits · One to two academic years

  select id into s_id from schools where code = 'engineering';
  insert into programmes (code, award_level, status)
  values ('diploma-in-web-development', 'Diploma', 'draft')
  on conflict (code) do nothing;
  -- Diploma in Web Development · 120 credits · One to two academic years

  select id into s_id from schools where code = 'engineering';
  insert into programmes (code, award_level, status)
  values ('diploma-in-hardware-maintenance', 'Diploma', 'draft')
  on conflict (code) do nothing;
  -- Diploma in Hardware Maintenance · 120 credits · One to two academic years

  select id into s_id from schools where code = 'engineering';
  insert into programmes (code, award_level, status)
  values ('diploma-in-laptop-chipset-technology', 'Diploma', 'draft')
  on conflict (code) do nothing;
  -- Diploma in Laptop and Chipset Technology · 120 credits · One to two academic years

  select id into s_id from schools where code = 'engineering';
  insert into programmes (code, award_level, status)
  values ('diploma-in-database-administration', 'Diploma', 'draft')
  on conflict (code) do nothing;
  -- Diploma in Database Administration · 120 credits · One to two academic years

  select id into s_id from schools where code = 'engineering';
  insert into programmes (code, award_level, status)
  values ('diploma-in-air-conditioning-refrigeration', 'Diploma', 'draft')
  on conflict (code) do nothing;
  -- Diploma in Air Conditioning and Refrigeration · 120 credits · One to two academic years

  select id into s_id from schools where code = 'engineering';
  insert into programmes (code, award_level, status)
  values ('diploma-in-computerized-accounting', 'Diploma', 'draft')
  on conflict (code) do nothing;
  -- Diploma in Computerised Accounting · 120 credits · One to two academic years

  select id into s_id from schools where code = 'engineering';
  insert into programmes (code, award_level, status)
  values ('diploma-in-secretarial-duties', 'Diploma', 'draft')
  on conflict (code) do nothing;
  -- Diploma in Secretarial Duties · 120 credits · One to two academic years

  select id into s_id from schools where code = 'business';
  insert into programmes (code, award_level, status)
  values ('diploma-in-business-management', 'Diploma', 'draft')
  on conflict (code) do nothing;
  -- Diploma in Business Management · 120 credits · One to two academic years

  select id into s_id from schools where code = 'business';
  insert into programmes (code, award_level, status)
  values ('diploma-in-project-management', 'Diploma', 'draft')
  on conflict (code) do nothing;
  -- Diploma in Project Management · 120 credits · One to two academic years

  select id into s_id from schools where code = 'business';
  insert into programmes (code, award_level, status)
  values ('diploma-in-accountancy', 'Diploma', 'draft')
  on conflict (code) do nothing;
  -- Diploma in Accountancy · 120 credits · One to two academic years

  select id into s_id from schools where code = 'business';
  insert into programmes (code, award_level, status)
  values ('diploma-in-banking-and-finance', 'Diploma', 'draft')
  on conflict (code) do nothing;
  -- Diploma in Banking and Finance · 120 credits · One to two academic years

  select id into s_id from schools where code = 'business';
  insert into programmes (code, award_level, status)
  values ('diploma-in-non-profit-management', 'Diploma', 'draft')
  on conflict (code) do nothing;
  -- Diploma in Non-Profit Management · 120 credits · One to two academic years

  select id into s_id from schools where code = 'business';
  insert into programmes (code, award_level, status)
  values ('diploma-in-insurance', 'Diploma', 'draft')
  on conflict (code) do nothing;
  -- Diploma in Insurance · 120 credits · One to two academic years

  select id into s_id from schools where code = 'business';
  insert into programmes (code, award_level, status)
  values ('diploma-in-executive-secretarial-duties', 'Diploma', 'draft')
  on conflict (code) do nothing;
  -- Diploma in Executive Secretarial Duties · 120 credits · One to two academic years

  select id into s_id from schools where code = 'business';
  insert into programmes (code, award_level, status)
  values ('diploma-in-bilingual-secretarial-duties', 'Diploma', 'draft')
  on conflict (code) do nothing;
  -- Diploma in Bilingual Secretarial Duties · 120 credits · One to two academic years

  select id into s_id from schools where code = 'theology';
  insert into programmes (code, award_level, status)
  values ('certificate-in-theology', 'Certificate', 'draft')
  on conflict (code) do nothing;
  -- Certificate of Theology · Up to one academic year

  select id into s_id from schools where code = 'theology';
  insert into programmes (code, award_level, status)
  values ('certificate-in-christian-education', 'Certificate', 'draft')
  on conflict (code) do nothing;
  -- Certificate of Christian Education · Up to one academic year

  select id into s_id from schools where code = 'theology';
  insert into programmes (code, award_level, status)
  values ('divinity', 'Bachelor''s', 'draft')
  on conflict (code) do nothing;
  -- Bachelor of Divinity · Three academic years

  select id into s_id from schools where code = 'theology';
  insert into programmes (code, award_level, status)
  values ('bachelor-of-theology', 'Bachelor''s', 'draft')
  on conflict (code) do nothing;
  -- Bachelor of Theology · 180 credits · Three academic years

  select id into s_id from schools where code = 'ministry';
  insert into programmes (code, award_level, status)
  values ('bachelor-of-ministry', 'Bachelor''s', 'draft')
  on conflict (code) do nothing;
  -- Bachelor of Ministry · 180 credits · Three academic years

  select id into s_id from schools where code = 'theology';
  insert into programmes (code, award_level, status)
  values ('bachelor-of-christian-education', 'Bachelor''s', 'draft')
  on conflict (code) do nothing;
  -- Bachelor of Christian Education · Three academic years

  select id into s_id from schools where code = 'theology';
  insert into programmes (code, award_level, status)
  values ('master-of-theology', 'Master''s', 'draft')
  on conflict (code) do nothing;
  -- Master of Theology · 120 credits · One to two academic years

  select id into s_id from schools where code = 'theology';
  insert into programmes (code, award_level, status)
  values ('master-of-divinity', 'Master''s', 'draft')
  on conflict (code) do nothing;
  -- Master of Divinity · 120 credits · One to two academic years

  select id into s_id from schools where code = 'ministry';
  insert into programmes (code, award_level, status)
  values ('masters-evangelism-mission', 'Master''s', 'draft')
  on conflict (code) do nothing;
  -- Masters in Evangelism and Mission · 120 credits · One to two academic years

  select id into s_id from schools where code = 'ministry';
  insert into programmes (code, award_level, status)
  values ('master-of-arts-christian-leadership', 'Master''s', 'draft')
  on conflict (code) do nothing;
  -- Master of Arts in Christian Leadership · 120 credits · One to two academic years

  select id into s_id from schools where code = 'theology';
  insert into programmes (code, award_level, status)
  values ('black-liberation-theology', 'Master''s', 'draft')
  on conflict (code) do nothing;
  -- Master of Arts in Black Liberation Theology · 120 credits · One to two academic years

  select id into s_id from schools where code = 'theology';
  insert into programmes (code, award_level, status)
  values ('doctor-of-philosophy-theology', 'Doctorate', 'draft')
  on conflict (code) do nothing;
  -- Doctor of Philosophy (Ph.D.) in Theology · Two academic years of supervised research

  select id into s_id from schools where code = 'theology';
  insert into programmes (code, award_level, status)
  values ('doctor-of-theology', 'Doctorate', 'draft')
  on conflict (code) do nothing;
  -- Doctor of Theology · Two academic years of supervised research

  select id into s_id from schools where code = 'theology';
  insert into programmes (code, award_level, status)
  values ('doctor-of-systematic-theology', 'Doctorate', 'draft')
  on conflict (code) do nothing;
  -- Doctor of Systematic Theology · Two academic years of supervised research

  select id into s_id from schools where code = 'ministry';
  insert into programmes (code, award_level, status)
  values ('doctor-of-ministry', 'Doctorate', 'draft')
  on conflict (code) do nothing;
  -- Doctor of Ministry · Two academic years of supervised research

  select id into s_id from schools where code = 'education';
  insert into programmes (code, award_level, status)
  values ('primary-education', 'Bachelor''s', 'draft')
  on conflict (code) do nothing;
  -- Primary Education · Three academic years

  select id into s_id from schools where code = 'education';
  insert into programmes (code, award_level, status)
  values ('special-education', 'Bachelor''s', 'draft')
  on conflict (code) do nothing;
  -- Special Education · Three academic years

  select id into s_id from schools where code = 'engineering';
  insert into programmes (code, award_level, status)
  values ('software-engineering', 'Bachelor''s', 'draft')
  on conflict (code) do nothing;
  -- Software Engineering · Three academic years

  select id into s_id from schools where code = 'engineering';
  insert into programmes (code, award_level, status)
  values ('networking', 'Diploma', 'draft')
  on conflict (code) do nothing;
  -- Computer Networking · 120 credits · One to two academic years

  select id into s_id from schools where code = 'business';
  insert into programmes (code, award_level, status)
  values ('business-management', 'Bachelor''s', 'draft')
  on conflict (code) do nothing;
  -- Business Management · Three academic years

  select id into s_id from schools where code = 'business';
  insert into programmes (code, award_level, status)
  values ('project-management', 'Master''s', 'draft')
  on conflict (code) do nothing;
  -- Project Management · 120 credits · One to two academic years

end $$;


-- ===========================================================================
-- 3. PROVE IT
-- ===========================================================================

do $$
declare
  n integer;
begin
  select count(*) into n from schools;
  if n < 5 then
    raise exception '060 FAILED: % schools seeded, expected at least 5', n;
  end if;

  select count(*) into n from programmes;
  if n < 41 then
    raise exception '060 FAILED: % programmes seeded, expected at least 41', n;
  end if;

  -- THE FIVE SCHOOLS BY NAME. A count alone passes if the right number of
  -- wrong rows is there, and the About page names these five specifically.
  select count(*) into n from schools
   where code in ('theology', 'engineering', 'business', 'ministry', 'education');
  if n <> 5 then
    raise exception '060 FAILED: % of the 5 published schools are present', n;
  end if;

  -- NOTHING IS OPEN. The check that matters: a seed that quietly advertised
  -- forty-one programmes to applicants would be the single most damaging
  -- thing this file could do.
  select count(*) into n from programmes where status <> 'draft';
  if n > 0 then
    raise exception '060 FAILED: % programmes are not drafts — the seed opened something for admission', n;
  end if;

  -- AND NO CURRICULUM WAS INVENTED.
  select count(*) into n from programme_versions;
  if n > 0 then
    raise exception '060 FAILED: % programme versions exist — a duration was invented', n;
  end if;

  raise notice '060 OK: 5 schools and 41 programmes are in the register, every one a draft';
  raise notice '060 OK: no curriculum and no duration was seeded — the University has published a range, not a length, for 27 of them';
end $$;


-- ===========================================================================
-- 4. VERIFY — READ THIS OUTPUT
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- THE REGISTER. Five schools, forty-one programmes, none open.
-- ---------------------------------------------------------------------------
select s.name as school,
       count(p.id) as programmes,
       count(*) filter (where p.status = 'open_for_admission') as open_for_admission
  from schools s
  left join programmes p on true
  group by s.name order by s.name;

-- ---------------------------------------------------------------------------
-- AND WHAT THE UNIVERSITY STILL HAS TO STATE.
--
-- 27 of 41 programmes have no length this system can record,
-- because what is published is a range. Each needs a duration before a
-- curriculum can be built for it:
--
--   diploma-in-theology                        Diploma      published: One to two academic years
--   diploma-in-ministry                        Diploma      published: One to two academic years
--   diploma-in-christian-leadership            Diploma      published: One to two academic years
--   diploma-in-computer-networking             Diploma      published: One to two academic years
--   diploma-in-software-engineering            Diploma      published: One to two academic years
--   diploma-in-web-development                 Diploma      published: One to two academic years
--   diploma-in-hardware-maintenance            Diploma      published: One to two academic years
--   diploma-in-laptop-chipset-technology       Diploma      published: One to two academic years
--   diploma-in-database-administration         Diploma      published: One to two academic years
--   diploma-in-air-conditioning-refrigeration  Diploma      published: One to two academic years
--   diploma-in-computerized-accounting         Diploma      published: One to two academic years
--   diploma-in-secretarial-duties              Diploma      published: One to two academic years
--   diploma-in-business-management             Diploma      published: One to two academic years
--   diploma-in-project-management              Diploma      published: One to two academic years
--   diploma-in-accountancy                     Diploma      published: One to two academic years
--   diploma-in-banking-and-finance             Diploma      published: One to two academic years
--   diploma-in-non-profit-management           Diploma      published: One to two academic years
--   diploma-in-insurance                       Diploma      published: One to two academic years
--   diploma-in-executive-secretarial-duties    Diploma      published: One to two academic years
--   diploma-in-bilingual-secretarial-duties    Diploma      published: One to two academic years
--   master-of-theology                         Master's     published: One to two academic years
--   master-of-divinity                         Master's     published: One to two academic years
--   masters-evangelism-mission                 Master's     published: One to two academic years
--   master-of-arts-christian-leadership        Master's     published: One to two academic years
--   black-liberation-theology                  Master's     published: One to two academic years
--   networking                                 Diploma      published: One to two academic years
--   project-management                         Master's     published: One to two academic years
--
-- The three the University HAS ruled — Bachelor's three years, Doctorate two,
-- Certificate up to one — need no further statement.
-- ---------------------------------------------------------------------------
select award_level, count(*) as programmes
  from programmes group by award_level order by award_level;
