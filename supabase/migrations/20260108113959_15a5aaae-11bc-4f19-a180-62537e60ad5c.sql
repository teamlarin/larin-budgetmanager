-- Add client_contact_id to projects table
ALTER TABLE public.projects 
ADD COLUMN client_contact_id uuid REFERENCES public.client_contacts(id) ON DELETE SET NULL;

-- Create index for better query performance
CREATE INDEX idx_projects_client_contact_id ON public.projects(client_contact_id);