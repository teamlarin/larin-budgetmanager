
-- Enable pg_cron and pg_net if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Schedule weekly progress reminder: every Thursday at 16:00 CET (14:00 UTC for CEST)
SELECT cron.schedule(
  'weekly-progress-reminder',
  '0 14 * * 4',
  $$
  SELECT
    net.http_post(
      url := 'https://dmwyqyqaseyuybqfawvk.supabase.co/functions/v1/send-progress-reminder',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtd3lxeXFhc2V5dXlicWZhd3ZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk5MzEyMDIsImV4cCI6MjA3NTUwNzIwMn0.YLKPhjU9h5NEq4IPrzXcfcdkzF_j8WaUTgeRCA9khh8"}'::jsonb,
      body := '{}'::jsonb
    ) AS request_id;
  $$
);
