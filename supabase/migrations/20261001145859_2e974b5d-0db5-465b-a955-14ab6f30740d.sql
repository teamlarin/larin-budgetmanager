SELECT cron.unschedule('generate-slack-progress-drafts-thursday');
SELECT cron.schedule(
  'generate-slack-progress-drafts-thursday',
  '0 7 * * 4',
  $$
  SELECT net.http_post(
    url := 'https://dmwyqyqaseyuybqfawvk.supabase.co/functions/v1/generate-slack-progress-drafts',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || coalesce((SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET'), ''),
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object('lookbackDays', 8, 'time', now()::text),
    timeout_milliseconds := 600000
  );
  $$
);