ALTER TABLE public.performance_objectives ADD COLUMN IF NOT EXISTS completion_percentage numeric NOT NULL DEFAULT 0;
CREATE OR REPLACE FUNCTION public.validate_objective_completion() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.completion_percentage < 0 OR NEW.completion_percentage > 100 THEN
    RAISE EXCEPTION 'La percentuale di completamento deve essere tra 0 e 100';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS validate_objective_completion_trg ON public.performance_objectives;
CREATE TRIGGER validate_objective_completion_trg BEFORE INSERT OR UPDATE ON public.performance_objectives FOR EACH ROW EXECUTE FUNCTION public.validate_objective_completion();