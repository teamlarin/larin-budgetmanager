-- Unschedule the existing weekly progress reminder job
SELECT cron.unschedule('weekly-progress-reminder');

-- Create the new weekly progress reminder cron job to run every Thursday at 16:00
SELECT cron.schedule(
  'weekly-progress-reminder',
  '0 16 * * 4', -- Every Thursday at 16:00 (4:00 PM)
  $$
  SELECT
    net.http_post(
        url:='https://dmwyqyqaseyuybqfawvk.supabase.co/functions/v1/send-progress-reminder',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtd3lxeXFhc2V5dXlicWZhd3ZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk5MzEyMDIsImV4cCI6MjA3NTUwNzIwMn0.YLKPhjU9h5NEq4IPrzXcfcdkzF_j8WaUTgeRCA9khh8"}'::jsonb,
        body:='{}'::jsonb
    ) as request_id;
  $$
);

-- Verify the job was created
SELECT jobname, schedule FROM cron.job WHERE jobname = 'weekly-progress-reminder';