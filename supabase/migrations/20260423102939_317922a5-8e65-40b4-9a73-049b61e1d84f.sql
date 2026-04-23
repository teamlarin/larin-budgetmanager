-- Tabella per tracciare i fallimenti già notificati (evita doppia notifica)
CREATE TABLE IF NOT EXISTS public.cron_failure_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  jobid bigint NOT NULL,
  runid bigint NOT NULL,
  jobname text NOT NULL,
  failed_at timestamptz NOT NULL,
  error_message text,
  notified_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (jobid, runid)
);

ALTER TABLE public.cron_failure_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view cron failure notifications"
  ON public.cron_failure_notifications FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_cron_failure_notif_failed_at
  ON public.cron_failure_notifications (failed_at DESC);

-- Funzione: ultimi run dei cron (admin only)
CREATE OR REPLACE FUNCTION public.admin_get_cron_runs(p_limit int DEFAULT 100)
RETURNS TABLE(
  jobid bigint,
  runid bigint,
  jobname text,
  schedule text,
  status text,
  return_message text,
  start_time timestamptz,
  end_time timestamptz,
  duration_ms numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Forbidden: admin role required';
  END IF;

  RETURN QUERY
  SELECT
    d.jobid,
    d.runid,
    j.jobname,
    j.schedule,
    d.status::text,
    d.return_message,
    d.start_time,
    d.end_time,
    EXTRACT(EPOCH FROM (d.end_time - d.start_time)) * 1000 AS duration_ms
  FROM cron.job_run_details d
  LEFT JOIN cron.job j ON j.jobid = d.jobid
  ORDER BY d.start_time DESC
  LIMIT GREATEST(1, LEAST(p_limit, 500));
END;
$$;

REVOKE ALL ON FUNCTION public.admin_get_cron_runs(int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_get_cron_runs(int) TO authenticated;

-- Funzione: stato per job (admin only)
CREATE OR REPLACE FUNCTION public.admin_get_cron_jobs_status()
RETURNS TABLE(
  jobid bigint,
  jobname text,
  schedule text,
  active boolean,
  last_run_status text,
  last_run_at timestamptz,
  last_run_message text,
  failures_24h bigint,
  total_runs_24h bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Forbidden: admin role required';
  END IF;

  RETURN QUERY
  WITH last_run AS (
    SELECT DISTINCT ON (d.jobid)
      d.jobid, d.status::text AS status, d.start_time, d.return_message
    FROM cron.job_run_details d
    ORDER BY d.jobid, d.start_time DESC
  ),
  agg AS (
    SELECT
      d.jobid,
      count(*) FILTER (WHERE d.status::text = 'failed') AS failures_24h,
      count(*) AS total_runs_24h
    FROM cron.job_run_details d
    WHERE d.start_time > now() - interval '24 hours'
    GROUP BY d.jobid
  )
  SELECT
    j.jobid,
    j.jobname,
    j.schedule,
    j.active,
    lr.status,
    lr.start_time,
    lr.return_message,
    COALESCE(a.failures_24h, 0),
    COALESCE(a.total_runs_24h, 0)
  FROM cron.job j
  LEFT JOIN last_run lr ON lr.jobid = j.jobid
  LEFT JOIN agg a ON a.jobid = j.jobid
  ORDER BY j.jobname;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_get_cron_jobs_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_get_cron_jobs_status() TO authenticated;

-- Cron job ogni 30 minuti che chiama monitor-cron-failures
SELECT cron.schedule(
  'monitor-cron-failures-every-30min',
  '*/30 * * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://dmwyqyqaseyuybqfawvk.supabase.co/functions/v1/monitor-cron-failures',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || coalesce((SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET'), ''),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $cron$
);