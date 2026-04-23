-- 1) Replace admin_run_cron_job_now to capture pg_net request_id and detect missing CRON_SECRET
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
  v_extracted_body JSONB;
  v_match TEXT[];
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

  -- Sanity check: vault CRON_SECRET present?
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

  -- Try to extract url + body from a standard "SELECT net.http_post(url := '...', headers := ..., body := ...)" command
  v_extracted_url := substring(v_command from $re$url\s*:?=\s*'([^']+)'$re$);

  IF v_extracted_url IS NOT NULL THEN
    -- Direct call: we control execution and capture request_id
    BEGIN
      SELECT net.http_post(
        url := v_extracted_url,
        headers := jsonb_build_object(
          'Authorization', 'Bearer ' || COALESCE(v_cron_secret, ''),
          'Content-Type', 'application/json',
          'x-cron-manual-trigger', v_invocation_id::text
        ),
        body := jsonb_build_object('manual', true, 'invocation_id', v_invocation_id, 'time', now()::text)
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
    -- Fallback: execute the raw command (no request_id capture)
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
    'message', 'Job inviato via pg_net. La risposta HTTP comparirà tra qualche secondo.'
  );
END;
$function$;

-- 2) New RPC: list recent manual invocations joined with pg_net response details
CREATE OR REPLACE FUNCTION public.admin_get_manual_invocations(p_limit integer DEFAULT 25)
 RETURNS TABLE(
   id uuid,
   jobid bigint,
   jobname text,
   invoked_by uuid,
   invoked_by_name text,
   invoked_at timestamp with time zone,
   request_id bigint,
   status text,
   error_message text,
   http_status_code int,
   http_response_preview text,
   http_responded_at timestamp with time zone
 )
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'net'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Forbidden: admin role required';
  END IF;

  RETURN QUERY
  SELECT
    i.id,
    i.jobid,
    i.jobname,
    i.invoked_by,
    COALESCE(p.first_name || ' ' || p.last_name, p.email, i.invoked_by::text) AS invoked_by_name,
    i.invoked_at,
    i.request_id,
    i.status,
    i.error_message,
    r.status_code AS http_status_code,
    LEFT(COALESCE(r.content::text, ''), 400) AS http_response_preview,
    r.created AS http_responded_at
  FROM public.cron_manual_invocations i
  LEFT JOIN public.profiles p ON p.id = i.invoked_by
  LEFT JOIN net._http_response r ON r.id = i.request_id
  ORDER BY i.invoked_at DESC
  LIMIT GREATEST(1, LEAST(p_limit, 200));
END;
$function$;