-- 1. Helper per (re)inserire un secret nel vault in modo idempotente
CREATE OR REPLACE FUNCTION public.admin_set_cron_secret(p_secret text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  v_existing_id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Forbidden: admin role required';
  END IF;

  SELECT id INTO v_existing_id FROM vault.secrets WHERE name = 'CRON_SECRET';

  IF v_existing_id IS NULL THEN
    PERFORM vault.create_secret(p_secret, 'CRON_SECRET', 'Shared cron auth token');
  ELSE
    PERFORM vault.update_secret(v_existing_id, p_secret, 'CRON_SECRET', 'Shared cron auth token');
  END IF;

  RETURN 'CRON_SECRET set';
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_cron_secret(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_cron_secret(text) TO authenticated;

-- 2. Riscrivi i cron job con URL hardcoded

SELECT cron.unschedule('generate-slack-progress-drafts-tuesday');
SELECT cron.schedule(
  'generate-slack-progress-drafts-tuesday',
  '0 19 * * 2',
  $cron$
  SELECT net.http_post(
    url := 'https://dmwyqyqaseyuybqfawvk.supabase.co/functions/v1/generate-slack-progress-drafts',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || coalesce((SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET'), ''),
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object('lookbackDays', 8, 'time', now()::text)
  );
  $cron$
);

SELECT cron.unschedule('generate-slack-progress-drafts-thursday');
SELECT cron.schedule(
  'generate-slack-progress-drafts-thursday',
  '0 10 * * 4',
  $cron$
  SELECT net.http_post(
    url := 'https://dmwyqyqaseyuybqfawvk.supabase.co/functions/v1/generate-slack-progress-drafts',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || coalesce((SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET'), ''),
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object('lookbackDays', 8, 'time', now()::text)
  );
  $cron$
);

SELECT cron.unschedule('sync-budget-drafts-8am');
SELECT cron.schedule(
  'sync-budget-drafts-8am',
  '0 8 * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://dmwyqyqaseyuybqfawvk.supabase.co/functions/v1/sync-budget-drafts',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || coalesce((SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET'), ''),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $cron$
);

SELECT cron.unschedule('sync-budget-drafts-12pm');
SELECT cron.schedule(
  'sync-budget-drafts-12pm',
  '0 12 * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://dmwyqyqaseyuybqfawvk.supabase.co/functions/v1/sync-budget-drafts',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || coalesce((SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET'), ''),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $cron$
);

SELECT cron.unschedule('sync-budget-drafts-6pm');
SELECT cron.schedule(
  'sync-budget-drafts-6pm',
  '0 18 * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://dmwyqyqaseyuybqfawvk.supabase.co/functions/v1/sync-budget-drafts',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || coalesce((SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET'), ''),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $cron$
);

SELECT cron.unschedule('weekly-progress-reminder');
SELECT cron.schedule(
  'weekly-progress-reminder',
  '0 16 * * 4',
  $cron$
  SELECT net.http_post(
    url := 'https://dmwyqyqaseyuybqfawvk.supabase.co/functions/v1/send-progress-reminder',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || coalesce((SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET'), ''),
      'Content-Type', 'application/json'
    ),
    body := concat('{"time": "', now(), '"}')::jsonb
  );
  $cron$
);