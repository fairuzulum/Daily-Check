-- Add searchable context to daily work logs without changing existing records.
alter table public.daily_logs
  add column if not exists performer_name text not null default '',
  add column if not exists department text not null default '',
  add column if not exists location text not null default '',
  add column if not exists ticket_number text;

alter table public.daily_logs
  add column if not exists activity_time time without time zone;

update public.daily_logs
set activity_time = created_at::time
where activity_time is null;

alter table public.daily_logs
  alter column activity_time set default localtime,
  alter column activity_time set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'daily_logs_ticket_number_length'
      and conrelid = 'public.daily_logs'::regclass
  ) then
    alter table public.daily_logs
      add constraint daily_logs_ticket_number_length
      check (ticket_number is null or char_length(ticket_number) between 1 and 80);
  end if;
end
$$;

create index if not exists daily_logs_user_department_date_idx
  on public.daily_logs (user_id, department, log_date desc);
create index if not exists daily_logs_user_location_date_idx
  on public.daily_logs (user_id, location, log_date desc);
