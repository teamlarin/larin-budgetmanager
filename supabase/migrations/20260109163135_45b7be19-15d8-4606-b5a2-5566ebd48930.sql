-- =====================================================
-- STEP 1: Create the budgets table
-- =====================================================
CREATE TABLE public.budgets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  client_id UUID REFERENCES public.clients(id),
  client_contact_id UUID REFERENCES public.client_contacts(id),
  user_id UUID NOT NULL,
  account_user_id UUID,
  status public.budget_status NOT NULL DEFAULT 'in_attesa',
  status_changed_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  total_budget NUMERIC DEFAULT 0,
  total_hours NUMERIC DEFAULT 0,
  margin_percentage NUMERIC DEFAULT 0,
  discount_percentage NUMERIC DEFAULT 0,
  payment_terms TEXT,
  discipline public.discipline,
  area TEXT,
  budget_template_id UUID REFERENCES public.budget_templates(id),
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  brief_link TEXT,
  objective TEXT,
  secondary_objective TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =====================================================
-- STEP 2: Add budget_id to budget_items
-- =====================================================
ALTER TABLE public.budget_items 
ADD COLUMN budget_id UUID REFERENCES public.budgets(id) ON DELETE CASCADE;

-- =====================================================
-- STEP 3: Migrate existing data - create a budget for each project
-- Use the same ID as the project for easy migration
-- =====================================================
INSERT INTO public.budgets (
  id, name, description, client_id, client_contact_id, user_id, account_user_id,
  status, status_changed_at, total_budget, total_hours, margin_percentage,
  discount_percentage, payment_terms, discipline, area, budget_template_id,
  project_id, brief_link, objective, secondary_objective, created_at, updated_at
)
SELECT 
  p.id,
  p.name,
  p.description,
  p.client_id,
  p.client_contact_id,
  p.user_id,
  p.account_user_id,
  p.status,
  p.status_changed_at,
  p.total_budget,
  p.total_hours,
  p.margin_percentage,
  p.discount_percentage,
  p.payment_terms,
  p.discipline,
  p.area,
  p.budget_template_id,
  p.id,
  p.brief_link,
  p.objective,
  p.secondary_objective,
  p.created_at,
  p.updated_at
FROM public.projects p;

-- =====================================================
-- STEP 4: Update budget_items to point to budgets
-- =====================================================
UPDATE public.budget_items 
SET budget_id = project_id;

-- =====================================================
-- STEP 5: Update quotes to reference budgets instead of projects
-- =====================================================
ALTER TABLE public.quotes
ADD COLUMN budget_id UUID REFERENCES public.budgets(id) ON DELETE CASCADE;

UPDATE public.quotes
SET budget_id = project_id;

-- =====================================================
-- STEP 6: Enable RLS and create policies for budgets
-- =====================================================
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Approved users can view all budgets" 
ON public.budgets FOR SELECT 
USING (is_approved_user(auth.uid()));

CREATE POLICY "Approved users can insert budgets" 
ON public.budgets FOR INSERT 
WITH CHECK (is_approved_user(auth.uid()));

CREATE POLICY "Approved users can update budgets" 
ON public.budgets FOR UPDATE 
USING (is_approved_user(auth.uid()));

CREATE POLICY "Approved users can delete budgets" 
ON public.budgets FOR DELETE 
USING (is_approved_user(auth.uid()));

CREATE POLICY "Users can create their own budgets" 
ON public.budgets FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own budgets" 
ON public.budgets FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own budgets" 
ON public.budgets FOR DELETE 
USING (auth.uid() = user_id);

-- =====================================================
-- STEP 7: Create trigger for updated_at
-- =====================================================
CREATE TRIGGER update_budgets_updated_at
BEFORE UPDATE ON public.budgets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- STEP 8: Create trigger for status_changed_at
-- =====================================================
CREATE OR REPLACE FUNCTION public.update_budget_status_changed_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    NEW.status_changed_at = now();
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER update_budget_status_timestamp
BEFORE UPDATE ON public.budgets
FOR EACH ROW
EXECUTE FUNCTION public.update_budget_status_changed_at();

-- =====================================================
-- STEP 9: Create index for performance
-- =====================================================
CREATE INDEX idx_budgets_user_id ON public.budgets(user_id);
CREATE INDEX idx_budgets_client_id ON public.budgets(client_id);
CREATE INDEX idx_budgets_project_id ON public.budgets(project_id);
CREATE INDEX idx_budgets_status ON public.budgets(status);
CREATE INDEX idx_budget_items_budget_id ON public.budget_items(budget_id);