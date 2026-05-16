-- Unschedule Jethr cron job (if exists)
DO $$
BEGIN
  PERFORM cron.unschedule('jethr-sync-hourly');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Drop Jethr tables
DROP TABLE IF EXISTS public.jethr_absence_tracking CASCADE;
DROP TABLE IF EXISTS public.jethr_activity_mappings CASCADE;
DROP TABLE IF EXISTS public.jethr_pending_requests CASCADE;
DROP TABLE IF EXISTS public.jethr_absences CASCADE;
DROP TABLE IF EXISTS public.jethr_holidays CASCADE;

-- Remove jethr_employee_id column from profiles
ALTER TABLE public.profiles DROP COLUMN IF EXISTS jethr_employee_id;