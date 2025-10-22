-- Add client_id column to projects table
ALTER TABLE public.projects ADD COLUMN client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL;

-- Add index for better query performance
CREATE INDEX idx_projects_client_id ON public.projects(client_id);