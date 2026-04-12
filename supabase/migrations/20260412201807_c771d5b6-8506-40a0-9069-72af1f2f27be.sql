-- Schedule sync-budget-drafts 3x daily
SELECT cron.schedule(
  'sync-budget-drafts-8am',
  '0 8 * * *',
  $$SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/sync-budget-drafts',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );$$
);

SELECT cron.schedule(
  'sync-budget-drafts-12pm',
  '0 12 * * *',
  $$SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/sync-budget-drafts',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );$$
);

SELECT cron.schedule(
  'sync-budget-drafts-6pm',
  '0 18 * * *',
  $$SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/sync-budget-drafts',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );$$
);