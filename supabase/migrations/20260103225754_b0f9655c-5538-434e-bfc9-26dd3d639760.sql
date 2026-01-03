-- Create table for project-service associations
CREATE TABLE public.project_services (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(project_id, service_id)
);

-- Enable Row Level Security
ALTER TABLE public.project_services ENABLE ROW LEVEL SECURITY;

-- Create policies for project services
CREATE POLICY "Approved users can view project services" 
ON public.project_services 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM profiles 
  WHERE profiles.id = auth.uid() AND profiles.approved = true
));

CREATE POLICY "Approved users can insert project services" 
ON public.project_services 
FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM profiles 
  WHERE profiles.id = auth.uid() AND profiles.approved = true
));

CREATE POLICY "Approved users can delete project services" 
ON public.project_services 
FOR DELETE 
USING (EXISTS (
  SELECT 1 FROM profiles 
  WHERE profiles.id = auth.uid() AND profiles.approved = true
));