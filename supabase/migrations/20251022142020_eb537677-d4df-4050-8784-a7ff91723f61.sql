-- Add account_user_id column to projects table
ALTER TABLE public.projects ADD COLUMN account_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Add index for better query performance
CREATE INDEX idx_projects_account_user_id ON public.projects(account_user_id);