-- Existing logs had only created_at; display their historical time in Jakarta.
update public.daily_logs
set activity_time = (created_at at time zone 'Asia/Jakarta')::time
where performer_name = ''
  and department = ''
  and location = '';
