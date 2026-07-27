-- Rimozione integrazione JetHr
DO $$
BEGIN
  PERFORM cron.unschedule(jobname) FROM cron.job WHERE jobname ILIKE '%jethr%';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DROP TABLE IF EXISTS public.jethr_absence_mappings CASCADE;
DROP TABLE IF EXISTS public.jethr_absence_tracking CASCADE;
DROP TABLE IF EXISTS public.jethr_activity_mappings CASCADE;
DROP TABLE IF EXISTS public.jethr_absences CASCADE;
DROP TABLE IF EXISTS public.jethr_pending_requests CASCADE;
DROP TABLE IF EXISTS public.jethr_holidays CASCADE;
DROP TABLE IF EXISTS public.jethr_auto_link_log CASCADE;

ALTER TABLE public.profiles DROP COLUMN IF EXISTS jethr_employee_id;

DELETE FROM public.app_settings WHERE setting_key IN ('jethr_enabled','jethr_detection','jethr_slack_channel','jethr_default_times');