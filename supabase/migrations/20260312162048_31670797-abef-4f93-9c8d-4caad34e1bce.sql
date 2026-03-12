-- Create the weekly planning reminder cron job to run every Thursday at 16:30
SELECT cron.schedule(
  'invoke-send-weekly-planning-reminder',
  '30 16 * * 4', -- Every Thursday at 16:30 (4:30 PM)
  $$
  SELECT
    net.http_post(
        url:='https://dmwyqyqaseyuybqfawvk.supabase.co/functions/v1/send-weekly-planning-reminder',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtd3lxeXFhc2V5dXlicWZhd3ZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk5MzEyMDIsImV4cCI6MjA3NTUwNzIwMn0.YLKPhjU9h5NEq4IPrzXcfcdkzF_j8WaUTgeRCA9khh8"}'::jsonb,
        body:='{}'::jsonb
    ) as request_id;
  $$
);