-- Daily Check: per-user work logs, follow-up tasks, and notes.
-- Apply this migration in Supabase SQL Editor before using the app.

create table if not exists public.daily_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  log_date date not null default current_date,
  title text not null check (char_length(title) between 1 and 160),
  details text not null default '' check (char_length(details) <= 5000),
  created_at timestamptz not null default now()
);

create table if not exists public.followup_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  details text not null default '' check (char_length(details) <= 5000),
  project text not null default '' check (char_length(project) <= 120),
  deadline date,
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high')),
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'done')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.work_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  body text not null default '' check (char_length(body) <= 10000),
  tag text not null default 'Umum' check (char_length(tag) <= 40),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists daily_logs_user_date_idx on public.daily_logs (user_id, log_date desc);
create index if not exists followup_tasks_user_deadline_idx on public.followup_tasks (user_id, deadline asc);
create index if not exists work_notes_user_updated_idx on public.work_notes (user_id, updated_at desc);

alter table public.daily_logs enable row level security;
alter table public.followup_tasks enable row level security;
alter table public.work_notes enable row level security;

create policy "Users can read their own daily logs" on public.daily_logs
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can add their own daily logs" on public.daily_logs
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can edit their own daily logs" on public.daily_logs
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users can delete their own daily logs" on public.daily_logs
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "Users can read their own follow-up tasks" on public.followup_tasks
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can add their own follow-up tasks" on public.followup_tasks
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can edit their own follow-up tasks" on public.followup_tasks
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users can delete their own follow-up tasks" on public.followup_tasks
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "Users can read their own work notes" on public.work_notes
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can add their own work notes" on public.work_notes
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can edit their own work notes" on public.work_notes
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users can delete their own work notes" on public.work_notes
  for delete to authenticated using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.daily_logs to authenticated;
grant select, insert, update, delete on public.followup_tasks to authenticated;
grant select, insert, update, delete on public.work_notes to authenticated;

-- Updated timestamps are managed by the client for now; no privileged trigger is needed.
