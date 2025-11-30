-- Create table for additional project expenses
CREATE TABLE public.project_additional_costs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  amount NUMERIC NOT NULL DEFAULT 0,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.project_additional_costs ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Approved users can view project additional costs"
ON public.project_additional_costs
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM profiles
  WHERE profiles.id = auth.uid() AND profiles.approved = true
));

CREATE POLICY "Approved users can insert project additional costs"
ON public.project_additional_costs
FOR INSERT
WITH CHECK (is_approved_user(auth.uid()));

CREATE POLICY "Approved users can update project additional costs"
ON public.project_additional_costs
FOR UPDATE
USING (is_approved_user(auth.uid()));

CREATE POLICY "Approved users can delete project additional costs"
ON public.project_additional_costs
FOR DELETE
USING (is_approved_user(auth.uid()));

-- Create trigger for updated_at
CREATE TRIGGER update_project_additional_costs_updated_at
BEFORE UPDATE ON public.project_additional_costs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();