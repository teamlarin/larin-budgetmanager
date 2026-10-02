CREATE OR REPLACE FUNCTION public.set_project_actual_end_date()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.project_status IS DISTINCT FROM OLD.project_status THEN
    IF NEW.project_status::text IN ('completato', 'interrotto') THEN
      IF NEW.actual_end_date IS NULL THEN
        NEW.actual_end_date := (now() AT TIME ZONE 'Europe/Rome')::date;
      END IF;
    ELSIF OLD.project_status::text IN ('completato', 'interrotto') THEN
      IF NEW.actual_end_date IS NOT DISTINCT FROM OLD.actual_end_date THEN
        NEW.actual_end_date := NULL;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;