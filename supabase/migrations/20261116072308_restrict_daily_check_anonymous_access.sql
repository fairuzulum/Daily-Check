-- This workspace requires sign-in; anonymous clients need no table privileges.
-- Authenticated access remains governed by the existing per-account RLS policies.
revoke all on public.daily_logs, public.followup_tasks, public.work_notes from anon;
