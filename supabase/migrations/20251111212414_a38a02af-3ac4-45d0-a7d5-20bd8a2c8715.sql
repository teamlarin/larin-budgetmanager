-- Add foreign key constraint to project_audit_log
ALTER TABLE public.project_audit_log
ADD CONSTRAINT fk_project_audit_log_user
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.project_audit_log
ADD CONSTRAINT fk_project_audit_log_project
FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;