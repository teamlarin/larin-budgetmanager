-- Schedule weekly Slack progress draft generation: every Thursday at 06:00 UTC
-- (= 08:00 Europe/Rome in summer DST, 07:00 in winter)
SELECT cron.schedule(
  'generate-slack-progress-drafts-thursday',
  '0 6 * * 4',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/generate-slack-progress-drafts',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET'),
      'Content-Type', 'application/json'
    ),
    body := concat('{"time": "', now(), '"}')::jsonb
  );
  $$
);