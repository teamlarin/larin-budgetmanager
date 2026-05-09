
-- Assicura estensioni richieste
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Rimuove eventuale job preesistente con stesso nome
DO $$
BEGIN
  PERFORM cron.unschedule('jethr-sync-hourly');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- Schedula il job orario (al minuto 0)
SELECT cron.schedule(
  'jethr-sync-hourly',
  '0 * * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://dmwyqyqaseyuybqfawvk.supabase.co/functions/v1/jethr-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET' LIMIT 1)
    ),
    body := '{}'::jsonb
  );
  $cron$
);
