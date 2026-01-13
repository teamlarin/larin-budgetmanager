-- Add project_leader_id column to projects table
ALTER TABLE public.projects
ADD COLUMN project_leader_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Add index for better query performance
CREATE INDEX idx_projects_project_leader_id ON public.projects(project_leader_id);