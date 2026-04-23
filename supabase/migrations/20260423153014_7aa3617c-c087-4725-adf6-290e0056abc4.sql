-- Fix: aumenta il timeout HTTP per i cron job che invocano edge function lunghe.
-- Default pg_net timeout è 5000ms, ma generate-slack-progress-drafts può durare 1-3 minuti.
-- Senza questo, la richiesta viene killata e la function viene terminata senza salvare i draft.

-- 1. Ricrea job 22 (tuesday) con timeout esteso a 600s
SELECT cron.unschedule('generate-slack-progress-drafts-tuesday');
SELECT cron.schedule(
  'generate-slack-progress-drafts-tuesday',
  '0 19 * * 2',
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

-- 2. Ricrea job 23 (thursday) con timeout esteso a 600s
SELECT cron.unschedule('generate-slack-progress-drafts-thursday');
SELECT cron.schedule(
  'generate-slack-progress-drafts-thursday',
  '0 10 * * 4',
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

-- 3. Aggiorna admin_run_cron_job_now per passare timeout_milliseconds esteso anche
--    quando l'invocazione è manuale (altrimenti restiamo bloccati al default 5s)
CREATE OR REPLACE FUNCTION public.admin_run_cron_job_now(p_jobid bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'cron', 'net', 'vault'
AS $function$
DECLARE
  v_jobname TEXT;
  v_command TEXT;
  v_request_id BIGINT;
  v_invocation_id UUID;
  v_user_id UUID;
  v_cron_secret TEXT;
  v_extracted_url TEXT;
BEGIN
  v_user_id := auth.uid();

  IF NOT public.has_role(v_user_id, 'admin') THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

  SELECT j.jobname::text, j.command::text
    INTO v_jobname, v_command
  FROM cron.job j
  WHERE j.jobid = p_jobid;

  IF v_jobname IS NULL THEN
    RAISE EXCEPTION 'Cron job % not found', p_jobid;
  END IF;

  IF v_command !~* 'net\.http_post' THEN
    RAISE EXCEPTION 'Manual execution only allowed for HTTP cron jobs (net.http_post)';
  END IF;

  -- Audit pre-esecuzione
  INSERT INTO public.cron_manual_invocations
    (jobid, jobname, invoked_by, command_preview, status)
  VALUES
    (p_jobid, v_jobname, v_user_id, LEFT(v_command, 500), 'queued')
  RETURNING id INTO v_invocation_id;

  SELECT decrypted_secret INTO v_cron_secret
  FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET';

  IF (v_cron_secret IS NULL OR v_cron_secret = '') AND v_command ILIKE '%CRON_SECRET%' THEN
    UPDATE public.cron_manual_invocations
       SET status = 'error',
           error_message = 'CRON_SECRET vault entry is missing or empty: HTTP call would return 401. Run admin_set_cron_secret(<value>) first.'
     WHERE id = v_invocation_id;

    RETURN jsonb_build_object(
      'ok', false,
      'jobname', v_jobname,
      'invocation_id', v_invocation_id,
      'error', 'CRON_SECRET vault entry missing or empty. Update vault before retrying.'
    );
  END IF;

  v_extracted_url := substring(v_command from $re$url\s*:?=\s*'([^']+)'$re$);

  IF v_extracted_url IS NOT NULL THEN
    BEGIN
      -- IMPORTANTE: timeout 600s (10 min) per le function lunghe come generate-slack-progress-drafts.
      -- Il default pg_net è 5s, troppo poco per processare ~200 progetti.
      SELECT net.http_post(
        url := v_extracted_url,
        headers := jsonb_build_object(
          'Authorization', 'Bearer ' || COALESCE(v_cron_secret, ''),
          'Content-Type', 'application/json',
          'x-cron-manual-trigger', v_invocation_id::text
        ),
        body := jsonb_build_object('manual', true, 'invocation_id', v_invocation_id, 'time', now()::text),
        timeout_milliseconds := 600000
      ) INTO v_request_id;

      UPDATE public.cron_manual_invocations
         SET status = 'sent',
             request_id = v_request_id
       WHERE id = v_invocation_id;
    EXCEPTION WHEN OTHERS THEN
      UPDATE public.cron_manual_invocations
         SET status = 'error',
             error_message = SQLERRM
       WHERE id = v_invocation_id;
      RAISE;
    END;
  ELSE
    BEGIN
      EXECUTE v_command;
      UPDATE public.cron_manual_invocations
         SET status = 'sent'
       WHERE id = v_invocation_id;
    EXCEPTION WHEN OTHERS THEN
      UPDATE public.cron_manual_invocations
         SET status = 'error', error_message = SQLERRM
       WHERE id = v_invocation_id;
      RAISE;
    END;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'jobname', v_jobname,
    'invocation_id', v_invocation_id,
    'request_id', v_request_id,
    'message', 'Job inviato via pg_net con timeout 600s. La risposta HTTP comparirà al termine (può richiedere fino a 10 min per function lunghe).'
  );
END;
$function$;