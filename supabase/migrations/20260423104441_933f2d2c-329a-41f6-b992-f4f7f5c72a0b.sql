-- 1. Tabella audit per esecuzioni manuali dei cron
CREATE TABLE IF NOT EXISTS public.cron_manual_invocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jobid BIGINT NOT NULL,
  jobname TEXT NOT NULL,
  invoked_by UUID NOT NULL,
  invoked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  request_id BIGINT,
  command_preview TEXT,
  status TEXT NOT NULL DEFAULT 'queued',
  error_message TEXT
);

ALTER TABLE public.cron_manual_invocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view manual cron invocations"
  ON public.cron_manual_invocations
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert manual cron invocations"
  ON public.cron_manual_invocations
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 2. Aggiorno admin_get_cron_jobs_status per includere last_success_at, last_failure_at e command
DROP FUNCTION IF EXISTS public.admin_get_cron_jobs_status();

CREATE OR REPLACE FUNCTION public.admin_get_cron_jobs_status()
RETURNS TABLE (
  jobid BIGINT,
  jobname TEXT,
  schedule TEXT,
  active BOOLEAN,
  command TEXT,
  last_run_status TEXT,
  last_run_at TIMESTAMPTZ,
  last_run_message TEXT,
  last_success_at TIMESTAMPTZ,
  last_failure_at TIMESTAMPTZ,
  failures_24h BIGINT,
  total_runs_24h BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

  RETURN QUERY
  WITH last_runs AS (
    SELECT DISTINCT ON (d.jobid)
      d.jobid,
      d.status::text AS status,
      d.start_time,
      d.return_message
    FROM cron.job_run_details d
    ORDER BY d.jobid, d.start_time DESC
  ),
  last_success AS (
    SELECT DISTINCT ON (d.jobid)
      d.jobid,
      d.start_time
    FROM cron.job_run_details d
    WHERE d.status::text = 'succeeded'
    ORDER BY d.jobid, d.start_time DESC
  ),
  last_failure AS (
    SELECT DISTINCT ON (d.jobid)
      d.jobid,
      d.start_time
    FROM cron.job_run_details d
    WHERE d.status::text = 'failed'
    ORDER BY d.jobid, d.start_time DESC
  ),
  stats_24h AS (
    SELECT
      d.jobid,
      COUNT(*) FILTER (WHERE d.status::text = 'failed') AS failures,
      COUNT(*) AS total
    FROM cron.job_run_details d
    WHERE d.start_time > now() - interval '24 hours'
    GROUP BY d.jobid
  )
  SELECT
    j.jobid,
    j.jobname::text,
    j.schedule::text,
    j.active,
    j.command::text,
    lr.status,
    lr.start_time,
    lr.return_message,
    ls.start_time AS last_success_at,
    lf.start_time AS last_failure_at,
    COALESCE(s.failures, 0) AS failures_24h,
    COALESCE(s.total, 0) AS total_runs_24h
  FROM cron.job j
  LEFT JOIN last_runs lr ON lr.jobid = j.jobid
  LEFT JOIN last_success ls ON ls.jobid = j.jobid
  LEFT JOIN last_failure lf ON lf.jobid = j.jobid
  LEFT JOIN stats_24h s ON s.jobid = j.jobid
  ORDER BY j.jobname;
END;
$$;

-- 3. RPC per esecuzione manuale di un cron job (admin-only, whitelist net.http_post)
CREATE OR REPLACE FUNCTION public.admin_run_cron_job_now(p_jobid BIGINT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron, net
AS $$
DECLARE
  v_jobname TEXT;
  v_command TEXT;
  v_request_id BIGINT;
  v_invocation_id UUID;
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();

  IF NOT public.has_role(v_user_id, 'admin') THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

  -- Carica job
  SELECT j.jobname::text, j.command::text
    INTO v_jobname, v_command
  FROM cron.job j
  WHERE j.jobid = p_jobid;

  IF v_jobname IS NULL THEN
    RAISE EXCEPTION 'Cron job % not found', p_jobid;
  END IF;

  -- Whitelist di sicurezza: accettiamo solo job che chiamano net.http_post
  IF v_command !~* 'net\.http_post' THEN
    RAISE EXCEPTION 'Manual execution only allowed for HTTP cron jobs (net.http_post)';
  END IF;

  -- Audit pre-esecuzione
  INSERT INTO public.cron_manual_invocations
    (jobid, jobname, invoked_by, command_preview, status)
  VALUES
    (p_jobid, v_jobname, v_user_id, LEFT(v_command, 500), 'queued')
  RETURNING id INTO v_invocation_id;

  -- Esegui il comando del job. Lo wrappiamo in un blocco per catturare il request_id
  -- se il comando è del tipo standard "select net.http_post(...) as request_id;"
  BEGIN
    EXECUTE v_command;
  EXCEPTION WHEN OTHERS THEN
    UPDATE public.cron_manual_invocations
       SET status = 'error', error_message = SQLERRM
     WHERE id = v_invocation_id;
    RAISE;
  END;

  RETURN jsonb_build_object(
    'ok', true,
    'jobname', v_jobname,
    'invocation_id', v_invocation_id,
    'message', 'Job esecuzione accodata via pg_net (asincrona). Controlla i log della edge function tra qualche secondo.'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_run_cron_job_now(BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_run_cron_job_now(BIGINT) TO authenticated;