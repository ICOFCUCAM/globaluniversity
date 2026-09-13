-- ===========================================================================
-- 061 — A VERSION FOR EVERY PROGRAMME
-- ===========================================================================
--
-- GENERATED FILE. DO NOT EDIT.
--   Generator: scripts/build-academic-seed.mjs
--
-- WHAT CHANGES FOR THE UNIVERSITY THE MOMENT THIS RUNS
--
-- EVERY ONE OF THE 41 PROGRAMMES GETS A CURRICULUM VERSION to hang
-- a curriculum from. 060 could not: 27 of them were published as "One to two
-- academic years", and a range is not a length. The University has since
-- ruled every level — Certificate one, Diploma one, Bachelor's three,
-- Master's two, Doctorate two — so `duration_years` can hold a number for
-- all of them.
--
-- EVERY VERSION IS A DRAFT, AND NONE HAS A SINGLE COURSE IN IT. A version
-- becomes real when the Vice-Chancellor approves it (058) and it cannot be
-- approved while its curriculum is empty of the credits it claims. This
-- builds the shelf; the University fills it.
--
-- THE LABEL IS THE ACADEMIC YEAR, and the effective date is the day that
-- year opens — 15 August, from 059. Nothing here is chosen: the version is
-- named after the year it takes effect in, which is how a student admitted
-- in 2026/2027 is later known to be reading the 2026/2027 curriculum.
-- ===========================================================================

do $$
declare
  y_label text;
  y_start date;
  p_id    uuid;
  s_id    uuid;
begin
  -- THE ACADEMIC YEAR IN FORCE, asked of the calendar rather than assumed.
  select label, starts_on into y_label, y_start from academic_years where status = 'current';
  if y_label is null then
    raise exception
      'No academic year is current, so a version cannot be dated. 059 sets one from the date; run it first.'
      using errcode = 'no_data_found';
  end if;

  select id into p_id from programmes where code = 'diploma-in-theology';
  select id into s_id from schools where code = 'theology';
  insert into programme_versions
    (programme_id, version_label, name, school_id, duration_years,
     semesters_per_year, total_credits, effective_from, status)
  values (p_id, y_label, 'Diploma in Theology', s_id, 1,
          2, 120, y_start, 'draft')
  on conflict (programme_id, version_label) do nothing;

  select id into p_id from programmes where code = 'diploma-in-ministry';
  select id into s_id from schools where code = 'ministry';
  insert into programme_versions
    (programme_id, version_label, name, school_id, duration_years,
     semesters_per_year, total_credits, effective_from, status)
  values (p_id, y_label, 'Diploma in Ministry', s_id, 1,
          2, 120, y_start, 'draft')
  on conflict (programme_id, version_label) do nothing;

  select id into p_id from programmes where code = 'diploma-in-christian-leadership';
  select id into s_id from schools where code = 'ministry';
  insert into programme_versions
    (programme_id, version_label, name, school_id, duration_years,
     semesters_per_year, total_credits, effective_from, status)
  values (p_id, y_label, 'Diploma in Christian Leadership', s_id, 1,
          2, 120, y_start, 'draft')
  on conflict (programme_id, version_label) do nothing;

  select id into p_id from programmes where code = 'diploma-in-computer-networking';
  select id into s_id from schools where code = 'engineering';
  insert into programme_versions
    (programme_id, version_label, name, school_id, duration_years,
     semesters_per_year, total_credits, effective_from, status)
  values (p_id, y_label, 'Diploma in Computer Networking', s_id, 1,
          2, 120, y_start, 'draft')
  on conflict (programme_id, version_label) do nothing;

  select id into p_id from programmes where code = 'diploma-in-software-engineering';
  select id into s_id from schools where code = 'engineering';
  insert into programme_versions
    (programme_id, version_label, name, school_id, duration_years,
     semesters_per_year, total_credits, effective_from, status)
  values (p_id, y_label, 'Diploma in Software Engineering', s_id, 1,
          2, 120, y_start, 'draft')
  on conflict (programme_id, version_label) do nothing;

  select id into p_id from programmes where code = 'diploma-in-web-development';
  select id into s_id from schools where code = 'engineering';
  insert into programme_versions
    (programme_id, version_label, name, school_id, duration_years,
     semesters_per_year, total_credits, effective_from, status)
  values (p_id, y_label, 'Diploma in Web Development', s_id, 1,
          2, 120, y_start, 'draft')
  on conflict (programme_id, version_label) do nothing;

  select id into p_id from programmes where code = 'diploma-in-hardware-maintenance';
  select id into s_id from schools where code = 'engineering';
  insert into programme_versions
    (programme_id, version_label, name, school_id, duration_years,
     semesters_per_year, total_credits, effective_from, status)
  values (p_id, y_label, 'Diploma in Hardware Maintenance', s_id, 1,
          2, 120, y_start, 'draft')
  on conflict (programme_id, version_label) do nothing;

  select id into p_id from programmes where code = 'diploma-in-laptop-chipset-technology';
  select id into s_id from schools where code = 'engineering';
  insert into programme_versions
    (programme_id, version_label, name, school_id, duration_years,
     semesters_per_year, total_credits, effective_from, status)
  values (p_id, y_label, 'Diploma in Laptop and Chipset Technology', s_id, 1,
          2, 120, y_start, 'draft')
  on conflict (programme_id, version_label) do nothing;

  select id into p_id from programmes where code = 'diploma-in-database-administration';
  select id into s_id from schools where code = 'engineering';
  insert into programme_versions
    (programme_id, version_label, name, school_id, duration_years,
     semesters_per_year, total_credits, effective_from, status)
  values (p_id, y_label, 'Diploma in Database Administration', s_id, 1,
          2, 120, y_start, 'draft')
  on conflict (programme_id, version_label) do nothing;

  select id into p_id from programmes where code = 'diploma-in-air-conditioning-refrigeration';
  select id into s_id from schools where code = 'engineering';
  insert into programme_versions
    (programme_id, version_label, name, school_id, duration_years,
     semesters_per_year, total_credits, effective_from, status)
  values (p_id, y_label, 'Diploma in Air Conditioning and Refrigeration', s_id, 1,
          2, 120, y_start, 'draft')
  on conflict (programme_id, version_label) do nothing;

  select id into p_id from programmes where code = 'diploma-in-computerized-accounting';
  select id into s_id from schools where code = 'engineering';
  insert into programme_versions
    (programme_id, version_label, name, school_id, duration_years,
     semesters_per_year, total_credits, effective_from, status)
  values (p_id, y_label, 'Diploma in Computerised Accounting', s_id, 1,
          2, 120, y_start, 'draft')
  on conflict (programme_id, version_label) do nothing;

  select id into p_id from programmes where code = 'diploma-in-secretarial-duties';
  select id into s_id from schools where code = 'engineering';
  insert into programme_versions
    (programme_id, version_label, name, school_id, duration_years,
     semesters_per_year, total_credits, effective_from, status)
  values (p_id, y_label, 'Diploma in Secretarial Duties', s_id, 1,
          2, 120, y_start, 'draft')
  on conflict (programme_id, version_label) do nothing;

  select id into p_id from programmes where code = 'diploma-in-business-management';
  select id into s_id from schools where code = 'business';
  insert into programme_versions
    (programme_id, version_label, name, school_id, duration_years,
     semesters_per_year, total_credits, effective_from, status)
  values (p_id, y_label, 'Diploma in Business Management', s_id, 1,
          2, 120, y_start, 'draft')
  on conflict (programme_id, version_label) do nothing;

  select id into p_id from programmes where code = 'diploma-in-project-management';
  select id into s_id from schools where code = 'business';
  insert into programme_versions
    (programme_id, version_label, name, school_id, duration_years,
     semesters_per_year, total_credits, effective_from, status)
  values (p_id, y_label, 'Diploma in Project Management', s_id, 1,
          2, 120, y_start, 'draft')
  on conflict (programme_id, version_label) do nothing;

  select id into p_id from programmes where code = 'diploma-in-accountancy';
  select id into s_id from schools where code = 'business';
  insert into programme_versions
    (programme_id, version_label, name, school_id, duration_years,
     semesters_per_year, total_credits, effective_from, status)
  values (p_id, y_label, 'Diploma in Accountancy', s_id, 1,
          2, 120, y_start, 'draft')
  on conflict (programme_id, version_label) do nothing;

  select id into p_id from programmes where code = 'diploma-in-banking-and-finance';
  select id into s_id from schools where code = 'business';
  insert into programme_versions
    (programme_id, version_label, name, school_id, duration_years,
     semesters_per_year, total_credits, effective_from, status)
  values (p_id, y_label, 'Diploma in Banking and Finance', s_id, 1,
          2, 120, y_start, 'draft')
  on conflict (programme_id, version_label) do nothing;

  select id into p_id from programmes where code = 'diploma-in-non-profit-management';
  select id into s_id from schools where code = 'business';
  insert into programme_versions
    (programme_id, version_label, name, school_id, duration_years,
     semesters_per_year, total_credits, effective_from, status)
  values (p_id, y_label, 'Diploma in Non-Profit Management', s_id, 1,
          2, 120, y_start, 'draft')
  on conflict (programme_id, version_label) do nothing;

  select id into p_id from programmes where code = 'diploma-in-insurance';
  select id into s_id from schools where code = 'business';
  insert into programme_versions
    (programme_id, version_label, name, school_id, duration_years,
     semesters_per_year, total_credits, effective_from, status)
  values (p_id, y_label, 'Diploma in Insurance', s_id, 1,
          2, 120, y_start, 'draft')
  on conflict (programme_id, version_label) do nothing;

  select id into p_id from programmes where code = 'diploma-in-executive-secretarial-duties';
  select id into s_id from schools where code = 'business';
  insert into programme_versions
    (programme_id, version_label, name, school_id, duration_years,
     semesters_per_year, total_credits, effective_from, status)
  values (p_id, y_label, 'Diploma in Executive Secretarial Duties', s_id, 1,
          2, 120, y_start, 'draft')
  on conflict (programme_id, version_label) do nothing;

  select id into p_id from programmes where code = 'diploma-in-bilingual-secretarial-duties';
  select id into s_id from schools where code = 'business';
  insert into programme_versions
    (programme_id, version_label, name, school_id, duration_years,
     semesters_per_year, total_credits, effective_from, status)
  values (p_id, y_label, 'Diploma in Bilingual Secretarial Duties', s_id, 1,
          2, 120, y_start, 'draft')
  on conflict (programme_id, version_label) do nothing;

  select id into p_id from programmes where code = 'certificate-in-theology';
  select id into s_id from schools where code = 'theology';
  insert into programme_versions
    (programme_id, version_label, name, school_id, duration_years,
     semesters_per_year, total_credits, effective_from, status)
  values (p_id, y_label, 'Certificate of Theology', s_id, 1,
          2, null, y_start, 'draft')
  on conflict (programme_id, version_label) do nothing;

  select id into p_id from programmes where code = 'certificate-in-christian-education';
  select id into s_id from schools where code = 'theology';
  insert into programme_versions
    (programme_id, version_label, name, school_id, duration_years,
     semesters_per_year, total_credits, effective_from, status)
  values (p_id, y_label, 'Certificate of Christian Education', s_id, 1,
          2, null, y_start, 'draft')
  on conflict (programme_id, version_label) do nothing;

  select id into p_id from programmes where code = 'divinity';
  select id into s_id from schools where code = 'theology';
  insert into programme_versions
    (programme_id, version_label, name, school_id, duration_years,
     semesters_per_year, total_credits, effective_from, status)
  values (p_id, y_label, 'Bachelor of Divinity', s_id, 3,
          2, null, y_start, 'draft')
  on conflict (programme_id, version_label) do nothing;

  select id into p_id from programmes where code = 'bachelor-of-theology';
  select id into s_id from schools where code = 'theology';
  insert into programme_versions
    (programme_id, version_label, name, school_id, duration_years,
     semesters_per_year, total_credits, effective_from, status)
  values (p_id, y_label, 'Bachelor of Theology', s_id, 3,
          2, 180, y_start, 'draft')
  on conflict (programme_id, version_label) do nothing;

  select id into p_id from programmes where code = 'bachelor-of-ministry';
  select id into s_id from schools where code = 'ministry';
  insert into programme_versions
    (programme_id, version_label, name, school_id, duration_years,
     semesters_per_year, total_credits, effective_from, status)
  values (p_id, y_label, 'Bachelor of Ministry', s_id, 3,
          2, 180, y_start, 'draft')
  on conflict (programme_id, version_label) do nothing;

  select id into p_id from programmes where code = 'bachelor-of-christian-education';
  select id into s_id from schools where code = 'theology';
  insert into programme_versions
    (programme_id, version_label, name, school_id, duration_years,
     semesters_per_year, total_credits, effective_from, status)
  values (p_id, y_label, 'Bachelor of Christian Education', s_id, 3,
          2, null, y_start, 'draft')
  on conflict (programme_id, version_label) do nothing;

  select id into p_id from programmes where code = 'master-of-theology';
  select id into s_id from schools where code = 'theology';
  insert into programme_versions
    (programme_id, version_label, name, school_id, duration_years,
     semesters_per_year, total_credits, effective_from, status)
  values (p_id, y_label, 'Master of Theology', s_id, 2,
          2, 120, y_start, 'draft')
  on conflict (programme_id, version_label) do nothing;

  select id into p_id from programmes where code = 'master-of-divinity';
  select id into s_id from schools where code = 'theology';
  insert into programme_versions
    (programme_id, version_label, name, school_id, duration_years,
     semesters_per_year, total_credits, effective_from, status)
  values (p_id, y_label, 'Master of Divinity', s_id, 2,
          2, 120, y_start, 'draft')
  on conflict (programme_id, version_label) do nothing;

  select id into p_id from programmes where code = 'masters-evangelism-mission';
  select id into s_id from schools where code = 'ministry';
  insert into programme_versions
    (programme_id, version_label, name, school_id, duration_years,
     semesters_per_year, total_credits, effective_from, status)
  values (p_id, y_label, 'Masters in Evangelism and Mission', s_id, 2,
          2, 120, y_start, 'draft')
  on conflict (programme_id, version_label) do nothing;

  select id into p_id from programmes where code = 'master-of-arts-christian-leadership';
  select id into s_id from schools where code = 'ministry';
  insert into programme_versions
    (programme_id, version_label, name, school_id, duration_years,
     semesters_per_year, total_credits, effective_from, status)
  values (p_id, y_label, 'Master of Arts in Christian Leadership', s_id, 2,
          2, 120, y_start, 'draft')
  on conflict (programme_id, version_label) do nothing;

  select id into p_id from programmes where code = 'black-liberation-theology';
  select id into s_id from schools where code = 'theology';
  insert into programme_versions
    (programme_id, version_label, name, school_id, duration_years,
     semesters_per_year, total_credits, effective_from, status)
  values (p_id, y_label, 'Master of Arts in Black Liberation Theology', s_id, 2,
          2, 120, y_start, 'draft')
  on conflict (programme_id, version_label) do nothing;

  select id into p_id from programmes where code = 'doctor-of-philosophy-theology';
  select id into s_id from schools where code = 'theology';
  insert into programme_versions
    (programme_id, version_label, name, school_id, duration_years,
     semesters_per_year, total_credits, effective_from, status)
  values (p_id, y_label, 'Doctor of Philosophy (Ph.D.) in Theology', s_id, 2,
          2, null, y_start, 'draft')
  on conflict (programme_id, version_label) do nothing;

  select id into p_id from programmes where code = 'doctor-of-theology';
  select id into s_id from schools where code = 'theology';
  insert into programme_versions
    (programme_id, version_label, name, school_id, duration_years,
     semesters_per_year, total_credits, effective_from, status)
  values (p_id, y_label, 'Doctor of Theology', s_id, 2,
          2, null, y_start, 'draft')
  on conflict (programme_id, version_label) do nothing;

  select id into p_id from programmes where code = 'doctor-of-systematic-theology';
  select id into s_id from schools where code = 'theology';
  insert into programme_versions
    (programme_id, version_label, name, school_id, duration_years,
     semesters_per_year, total_credits, effective_from, status)
  values (p_id, y_label, 'Doctor of Systematic Theology', s_id, 2,
          2, null, y_start, 'draft')
  on conflict (programme_id, version_label) do nothing;

  select id into p_id from programmes where code = 'doctor-of-ministry';
  select id into s_id from schools where code = 'ministry';
  insert into programme_versions
    (programme_id, version_label, name, school_id, duration_years,
     semesters_per_year, total_credits, effective_from, status)
  values (p_id, y_label, 'Doctor of Ministry', s_id, 2,
          2, null, y_start, 'draft')
  on conflict (programme_id, version_label) do nothing;

  select id into p_id from programmes where code = 'primary-education';
  select id into s_id from schools where code = 'education';
  insert into programme_versions
    (programme_id, version_label, name, school_id, duration_years,
     semesters_per_year, total_credits, effective_from, status)
  values (p_id, y_label, 'Primary Education', s_id, 3,
          2, null, y_start, 'draft')
  on conflict (programme_id, version_label) do nothing;

  select id into p_id from programmes where code = 'special-education';
  select id into s_id from schools where code = 'education';
  insert into programme_versions
    (programme_id, version_label, name, school_id, duration_years,
     semesters_per_year, total_credits, effective_from, status)
  values (p_id, y_label, 'Special Education', s_id, 3,
          2, null, y_start, 'draft')
  on conflict (programme_id, version_label) do nothing;

  select id into p_id from programmes where code = 'software-engineering';
  select id into s_id from schools where code = 'engineering';
  insert into programme_versions
    (programme_id, version_label, name, school_id, duration_years,
     semesters_per_year, total_credits, effective_from, status)
  values (p_id, y_label, 'Software Engineering', s_id, 3,
          2, null, y_start, 'draft')
  on conflict (programme_id, version_label) do nothing;

  select id into p_id from programmes where code = 'networking';
  select id into s_id from schools where code = 'engineering';
  insert into programme_versions
    (programme_id, version_label, name, school_id, duration_years,
     semesters_per_year, total_credits, effective_from, status)
  values (p_id, y_label, 'Computer Networking', s_id, 1,
          2, 120, y_start, 'draft')
  on conflict (programme_id, version_label) do nothing;

  select id into p_id from programmes where code = 'business-management';
  select id into s_id from schools where code = 'business';
  insert into programme_versions
    (programme_id, version_label, name, school_id, duration_years,
     semesters_per_year, total_credits, effective_from, status)
  values (p_id, y_label, 'Business Management', s_id, 3,
          2, null, y_start, 'draft')
  on conflict (programme_id, version_label) do nothing;

  select id into p_id from programmes where code = 'project-management';
  select id into s_id from schools where code = 'business';
  insert into programme_versions
    (programme_id, version_label, name, school_id, duration_years,
     semesters_per_year, total_credits, effective_from, status)
  values (p_id, y_label, 'Project Management', s_id, 2,
          2, 120, y_start, 'draft')
  on conflict (programme_id, version_label) do nothing;

end $$;


-- ===========================================================================
-- PROVE IT
-- ===========================================================================

do $$
declare n integer; bad integer;
begin
  select count(*) into n from programme_versions;
  if n < 41 then
    raise exception '061 FAILED: % versions, expected at least 41', n;
  end if;

  -- EVERY PROGRAMME HAS ONE. A count alone passes if one programme has two.
  select count(*) into bad from programmes p
   where not exists (select 1 from programme_versions v where v.programme_id = p.id);
  if bad > 0 then
    raise exception '061 FAILED: % programmes still have no version', bad;
  end if;

  -- AND NOT ONE IS PUBLISHED. A version published here would have skipped
  -- the Vice-Chancellor, which is the whole of 058.
  select count(*) into bad from programme_versions where status <> 'draft';
  if bad > 0 then
    raise exception '061 FAILED: % versions are not drafts — the seed approved a curriculum', bad;
  end if;

  -- THE RULED LENGTHS, READ BACK. Not a spot check: every level at once.
  select count(*) into bad from programme_versions v
    join programmes p on p.id = v.programme_id
   where v.duration_years <> case p.award_level
           when 'Certificate' then 1
           when 'Diploma' then 1
           when 'Bachelor''s' then 3
           when 'Master''s' then 2
           when 'Doctorate' then 2
           else v.duration_years end;
  if bad > 0 then
    raise exception '061 FAILED: % versions disagree with the ruled length for their award', bad;
  end if;

  raise notice '061 OK: all 41 programmes have a version, every one a draft with no courses in it';
  raise notice '061 OK: every duration matches the length the University ruled for its award level';
end $$;


-- ===========================================================================
-- VERIFY — READ THIS OUTPUT
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- EVERY PROGRAMME, ITS LENGTH AND WHAT ITS CURRICULUM ADDS UP TO SO FAR.
-- `credits_in_curriculum` is 0 for all of them: the shelf is built and empty.
-- The gap against `total_credits` is the Curriculum Builder's work.
-- ---------------------------------------------------------------------------
select p.award_level,
       count(*)                                              as programmes,
       min(v.duration_years)                                 as years,
       count(*) filter (where v.total_credits is not null)   as with_a_credit_total,
       count(*) filter (where v.status = 'draft')            as drafts
  from programmes p
  join programme_versions v on v.programme_id = p.id
  group by p.award_level order by p.award_level;
