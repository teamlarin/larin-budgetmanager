-- Remove old single weekly cron
SELECT cron.unschedule('generate-slack-progress-drafts-thursday');

-- Tuesday 21:00 Europe/Rome (CEST = UTC+2 → 19:00 UTC)
SELECT cron.schedule(
  'generate-slack-progress-drafts-tuesday',
  '0 19 * * 2',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/generate-slack-progress-drafts',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET'),
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object('lookbackDays', 8, 'time', now()::text)
  );
  $$
);

-- Thursday 12:00 Europe/Rome (CEST = UTC+2 → 10:00 UTC)
SELECT cron.schedule(
  'generate-slack-progress-drafts-thursday',
  '0 10 * * 4',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/generate-slack-progress-drafts',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET'),
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object('lookbackDays', 8, 'time', now()::text)
  );
  $$
);