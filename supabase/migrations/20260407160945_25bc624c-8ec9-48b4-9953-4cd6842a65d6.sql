
-- Step 1: Remove duplicate weekly-planning-reminder (jobid 4)
SELECT cron.unschedule('send-weekly-planning-reminder');

-- Step 2: Update existing cron jobs to use CRON_SECRET
-- Job: send-monthly-timesheet-reminder
SELECT cron.alter_job(
  (SELECT jobid FROM cron.job WHERE jobname = 'send-monthly-timesheet-reminder'),
  command := $$
  SELECT net.http_post(
    url := 'https://dmwyqyqaseyuybqfawvk.supabase.co/functions/v1/send-monthly-timesheet-reminder',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer qO_3qdV3ODMO6AZ4iRbFIKE1ZKVs065ep9xPkcpwOJo"}'::jsonb,
    body := concat('{"time": "', now(), '"}')::jsonb
  ) as request_id;
  $$
);

-- Job: invoke-send-weekly-planning-reminder
SELECT cron.alter_job(
  (SELECT jobid FROM cron.job WHERE jobname = 'invoke-send-weekly-planning-reminder'),
  command := $$
  SELECT net.http_post(
    url := 'https://dmwyqyqaseyuybqfawvk.supabase.co/functions/v1/send-weekly-planning-reminder',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer qO_3qdV3ODMO6AZ4iRbFIKE1ZKVs065ep9xPkcpwOJo"}'::jsonb,
    body := concat('{"time": "', now(), '"}')::jsonb
  ) as request_id;
  $$
);

-- Job: weekly-progress-reminder
SELECT cron.alter_job(
  (SELECT jobid FROM cron.job WHERE jobname = 'weekly-progress-reminder'),
  command := $$
  SELECT net.http_post(
    url := 'https://dmwyqyqaseyuybqfawvk.supabase.co/functions/v1/send-progress-reminder',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer qO_3qdV3ODMO6AZ4iRbFIKE1ZKVs065ep9xPkcpwOJo"}'::jsonb,
    body := concat('{"time": "', now(), '"}')::jsonb
  ) as request_id;
  $$
);

-- Job: weekly-ai-summary
SELECT cron.alter_job(
  (SELECT jobid FROM cron.job WHERE jobname = 'weekly-ai-summary'),
  command := $$
  SELECT net.http_post(
    url := 'https://dmwyqyqaseyuybqfawvk.supabase.co/functions/v1/send-weekly-ai-summary',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer qO_3qdV3ODMO6AZ4iRbFIKE1ZKVs065ep9xPkcpwOJo"}'::jsonb,
    body := concat('{"time": "', now(), '"}')::jsonb
  ) as request_id;
  $$
);

-- Job: sync-google-sheet-hourly
SELECT cron.alter_job(
  (SELECT jobid FROM cron.job WHERE jobname = 'sync-google-sheet-hourly'),
  command := $$
  SELECT net.http_post(
    url := 'https://dmwyqyqaseyuybqfawvk.supabase.co/functions/v1/sync-google-sheet',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer qO_3qdV3ODMO6AZ4iRbFIKE1ZKVs065ep9xPkcpwOJo"}'::jsonb,
    body := concat('{"time": "', now(), '"}')::jsonb
  ) as request_id;
  $$
);

-- Step 3: Create 2 new cron jobs
-- check-margin-alerts: daily at 08:00
SELECT cron.schedule(
  'check-margin-alerts',
  '0 8 * * *',
  $$
  SELECT net.http_post(
    url := 'https://dmwyqyqaseyuybqfawvk.supabase.co/functions/v1/check-margin-alerts',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer qO_3qdV3ODMO6AZ4iRbFIKE1ZKVs065ep9xPkcpwOJo"}'::jsonb,
    body := concat('{"time": "', now(), '"}')::jsonb
  ) as request_id;
  $$
);

-- check-project-deadlines: daily at 08:30
SELECT cron.schedule(
  'check-project-deadlines',
  '30 8 * * *',
  $$
  SELECT net.http_post(
    url := 'https://dmwyqyqaseyuybqfawvk.supabase.co/functions/v1/check-project-deadlines',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer qO_3qdV3ODMO6AZ4iRbFIKE1ZKVs065ep9xPkcpwOJo"}'::jsonb,
    body := concat('{"time": "', now(), '"}')::jsonb
  ) as request_id;
  $$
);
