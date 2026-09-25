ALTER TYPE public.project_status ADD VALUE IF NOT EXISTS 'interrotto';

ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS actual_end_date DATE;

CREATE OR REPLACE FUNCTION public.set_project_actual_end_date()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.project_status IS DISTINCT FROM OLD.project_status THEN
    IF NEW.project_status::text IN ('completato', 'interrotto') THEN
      IF NEW.actual_end_date IS NULL OR NEW.actual_end_date IS NOT DISTINCT FROM OLD.actual_end_date THEN
        NEW.actual_end_date := (now() AT TIME ZONE 'Europe/Rome')::date;
      END IF;
    ELSE
      IF NEW.actual_end_date IS NOT DISTINCT FROM OLD.actual_end_date THEN
        NEW.actual_end_date := NULL;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_project_actual_end_date ON public.projects;
CREATE TRIGGER trg_set_project_actual_end_date
BEFORE UPDATE ON public.projects
FOR EACH ROW
EXECUTE FUNCTION public.set_project_actual_end_date();
