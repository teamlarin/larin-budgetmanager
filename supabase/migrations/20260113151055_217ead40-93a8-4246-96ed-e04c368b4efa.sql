-- Create budget_services table to store services selected during budget creation
CREATE TABLE public.budget_services (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  budget_id UUID NOT NULL REFERENCES public.budgets(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(budget_id, service_id)
);

-- Enable RLS
ALTER TABLE public.budget_services ENABLE ROW LEVEL SECURITY;

-- RLS policies for budget_services
CREATE POLICY "Users can view budget services" 
ON public.budget_services 
FOR SELECT 
USING (public.is_approved_user(auth.uid()));

CREATE POLICY "Users can insert budget services" 
ON public.budget_services 
FOR INSERT 
WITH CHECK (public.is_approved_user(auth.uid()));

CREATE POLICY "Users can delete budget services" 
ON public.budget_services 
FOR DELETE 
USING (public.is_approved_user(auth.uid()));

-- Create function to copy services when budget is approved
CREATE OR REPLACE FUNCTION public.copy_budget_services_to_project()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only trigger when status changes to 'approvato'
  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'approvato' THEN
    -- Copy services from budget_services to project_services
    -- Use NEW.id as project_id since approved budgets become projects
    INSERT INTO public.project_services (project_id, service_id)
    SELECT NEW.id, bs.service_id
    FROM public.budget_services bs
    WHERE bs.budget_id = NEW.id
    ON CONFLICT DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on projects table for when budget is approved
CREATE TRIGGER copy_services_on_budget_approval
AFTER UPDATE ON public.projects
FOR EACH ROW
EXECUTE FUNCTION public.copy_budget_services_to_project();