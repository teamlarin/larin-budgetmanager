
-- Unschedule prior duplicate if exists
DO $$
BEGIN
  PERFORM cron.unschedule('jethr-auto-link-every-10min');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'jethr-auto-link-every-10min',
  '*/10 * * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://dmwyqyqaseyuybqfawvk.supabase.co/functions/v1/jethr-auto-link-events',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET')
    ),
    body := '{}'::jsonb
  );
  $cron$
);
