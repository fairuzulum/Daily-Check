-- Approved department catalog supplied by the workspace owner.
-- Initials are intentionally NOT unique: multiple departments share a code.
create table public.daily_check_departments (
  name text primary key,
  initial text not null,
  sort_order integer not null unique,
  check (char_length(name) between 1 and 120),
  check (char_length(initial) between 1 and 10)
);
alter table public.daily_check_departments enable row level security;
revoke all on public.daily_check_departments from public, anon, authenticated;
grant select on public.daily_check_departments to authenticated;
create policy departments_read on public.daily_check_departments
for select to authenticated using (true);

insert into public.daily_check_departments(name,initial,sort_order) values
  ('Accounting and Tax','FIN',1),
  ('Ancillary Services and Medical Affair','AMA',2),
  ('Business','BD',3),
  ('Day Care & Endoscopy','DC',4),
  ('Dialysis','HD',5),
  ('Emergency','ED',6),
  ('Emergency Nursing','ED',7),
  ('Finance','FIN',8),
  ('Finance and Administration','FIN',9),
  ('Finance, Accounting and Tax','FIN',10),
  ('FM & GA','FMS',11),
  ('Front Office','FO',12),
  ('Front Office Services','FO',13),
  ('General Affairs','GA',14),
  ('General Ward Nursing','NS',15),
  ('Hospital Director','MGN',16),
  ('Human Capital','HC',17),
  ('ICU/ICCU/HCU','CU',18),
  ('Inpatient Pharmacy','IPD',19),
  ('Laboratory Services','LAB',20),
  ('Maintenance','FMS',21),
  ('Marketing and Sales','MKT',22),
  ('Maternity & LDS Ward Nursing','NS',23),
  ('Medical Check Up Services','MCU',24),
  ('Medical Record','MR',25),
  ('Medical Rehabilitation','RHB',26),
  ('Nursing','NUR',27),
  ('Nursing Development','NUR',28),
  ('Nutrition & Dietetics','NUT',29),
  ('Operating Theatre Nursing','OT',30),
  ('Operations and Services','OPS',31),
  ('Outpatient Pharmacy','OPD',32),
  ('Outpatient Services','OPD',33),
  ('Outpatient Services Nursing','OPD',34),
  ('Pharmacy Services','PHA',35),
  ('Procurement','PUR',36),
  ('Quality and Risk','QR',37),
  ('Radiology Services','RAD',38),
  ('Ward Clerk','WCR',39),
  ('Casemix','CSX',40);

-- Normalize exact names and initials that identify exactly one approved name.
-- Preserve unresolved historical values rather than guessing a new department.
update public.daily_logs l set department=d.name
from public.daily_check_departments d
where lower(btrim(regexp_replace(l.department,'\s+',' ','g')))=lower(d.name)
  and l.department is distinct from d.name;
with unique_initials as (
  select initial,min(name) as name from public.daily_check_departments
  group by initial having count(*)=1
)
update public.daily_logs l set department=d.name from unique_initials d
where upper(btrim(l.department))=d.initial and l.department is distinct from d.name;

-- Enforce the catalog even for older clients or direct API writes.
create function public.daily_check_validate_department() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if not exists(select 1 from public.daily_check_departments d where d.name=new.department) then
    raise exception 'Pilih departemen dari daftar resmi. Departemen baru tidak diperbolehkan.' using errcode='23514';
  end if;
  return new;
end;
$$;
revoke all on function public.daily_check_validate_department() from public,anon,authenticated;
create trigger daily_logs_department before insert or update of department on public.daily_logs
for each row execute function public.daily_check_validate_department();

create or replace function public.daily_check_summary(p_today date) returns jsonb
language sql stable security invoker set search_path = '' as $$
select jsonb_build_object(
 'today', (select count(*) from public.daily_logs where user_id=auth.uid() and log_date=p_today),
 'all', (select count(*) from public.followup_tasks where user_id=auth.uid()),
 'open', (select count(*) from public.followup_tasks where user_id=auth.uid() and status<>'done'),
 'todo', (select count(*) from public.followup_tasks where user_id=auth.uid() and status='todo'),
 'in_progress', (select count(*) from public.followup_tasks where user_id=auth.uid() and status='in_progress'),
 'done', (select count(*) from public.followup_tasks where user_id=auth.uid() and status='done'),
 'high', (select count(*) from public.followup_tasks where user_id=auth.uid() and priority='high' and status<>'done'),
 'overdue', (select count(*) from public.followup_tasks where user_id=auth.uid() and deadline<p_today and status<>'done'),
 'performers', coalesce((select jsonb_agg(v order by v) from (select distinct performer_name v from public.daily_logs where user_id=auth.uid() and performer_name<>'') q),'[]'::jsonb),
 'departments', coalesce((select jsonb_agg(name order by sort_order) from public.daily_check_departments),'[]'::jsonb),
 'department_options', coalesce((select jsonb_agg(jsonb_build_object('name',name,'initial',initial) order by sort_order) from public.daily_check_departments),'[]'::jsonb),
 'locations', coalesce((select jsonb_agg(name order by name) from public.work_locations where user_id=auth.uid()),'[]'::jsonb)
);
$$;
revoke all on function public.daily_check_summary(date) from public,anon;
grant execute on function public.daily_check_summary(date) to authenticated;
