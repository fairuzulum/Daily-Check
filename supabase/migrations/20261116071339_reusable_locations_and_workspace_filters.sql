-- Reusable, account-owned locations. A database constraint prevents duplicates,
-- including concurrent saves from multiple tabs.
create table public.work_locations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 160),
  normalized_name text generated always as (lower(btrim(regexp_replace(name, '\s+', ' ', 'g')))) stored,
  created_at timestamptz not null default now(),
  unique (user_id, normalized_name)
);
alter table public.work_locations enable row level security;
revoke all on public.work_locations from anon;
grant select, insert, update on public.work_locations to authenticated;
create policy locations_select on public.work_locations for select to authenticated using ((select auth.uid()) = user_id);
create policy locations_insert on public.work_locations for insert to authenticated with check ((select auth.uid()) = user_id);
create policy locations_update on public.work_locations for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

insert into public.work_locations(user_id,name)
select distinct on (user_id,lower(btrim(regexp_replace(location,'\s+',' ','g'))))
 user_id,btrim(regexp_replace(location,'\s+',' ','g'))
from public.daily_logs where btrim(location) <> ''
order by user_id,lower(btrim(regexp_replace(location,'\s+',' ','g'))),created_at,id;

update public.daily_logs d set location=l.name from public.work_locations l
where d.user_id=l.user_id and lower(btrim(regexp_replace(d.location,'\s+',' ','g')))=l.normalized_name and d.location is distinct from l.name;

create function public.daily_check_canonical_location() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  new.location := btrim(regexp_replace(new.location,'\s+',' ','g'));
  if new.location <> '' then
    insert into public.work_locations(user_id,name) values(new.user_id,new.location)
    on conflict(user_id,normalized_name) do update set name=work_locations.name
    returning name into new.location;
  end if;
  return new;
end;
$$;
revoke all on function public.daily_check_canonical_location() from public,anon;
create trigger daily_logs_location before insert or update of location on public.daily_logs
for each row execute function public.daily_check_canonical_location();
alter table public.daily_logs alter column activity_time drop default;
create index if not exists daily_logs_page_idx on public.daily_logs(user_id,log_date desc,activity_time desc,id desc);
create index if not exists followup_tasks_page_idx on public.followup_tasks(user_id,deadline,id);

-- Only aggregate the signed-in user's rows. SECURITY INVOKER also preserves RLS.
create function public.daily_check_summary(p_today date) returns jsonb
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
 'departments', coalesce((select jsonb_agg(v order by v) from (select distinct department v from public.daily_logs where user_id=auth.uid() and department<>'') q),'[]'::jsonb),
 'locations', coalesce((select jsonb_agg(name order by name) from public.work_locations where user_id=auth.uid()),'[]'::jsonb)
);
$$;
revoke all on function public.daily_check_summary(date) from public,anon;
grant execute on function public.daily_check_summary(date) to authenticated;
