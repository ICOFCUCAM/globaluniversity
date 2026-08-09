-- Did anything from that test survive? All four should be 0.
select 'test applicants'     as what, count(*) as should_be_zero from students where matric_no like 'E2E-%'
union all
select 'test decisions',  count(*) from admission_decisions d
  join students s on s.id = d.application_id where s.matric_no like 'E2E-%'
union all
select 'test audit rows', count(*) from admission_audit_log a
  join students s on s.id = a.application_id where s.matric_no like 'E2E-%'
union all
select 'burnt numbers',   count(*) from students where student_number = 'ICOF202600001';

-- And are the append-only triggers back on? Both must say 'O' (enabled).
select tgname, tgenabled from pg_trigger
where tgname in ('admission_decisions_no_change', 'admission_audit_log_no_change');
