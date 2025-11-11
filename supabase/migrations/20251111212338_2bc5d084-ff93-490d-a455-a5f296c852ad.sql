-- Create project_audit_log table to track all changes
CREATE TABLE IF NOT EXISTS public.project_audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL,
  user_id UUID NOT NULL,
  action TEXT NOT NULL,
  field_name TEXT,
  old_value TEXT,
  new_value TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.project_audit_log ENABLE ROW LEVEL SECURITY;

-- Create policies for audit log
CREATE POLICY "Approved users can view audit logs for projects they can access"
ON public.project_audit_log
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM profiles
    WHERE profiles.id = auth.uid() AND profiles.approved = true
  )
);

CREATE POLICY "System can insert audit logs"
ON public.project_audit_log
FOR INSERT
WITH CHECK (true);

-- Create function to log project changes
CREATE OR REPLACE FUNCTION public.log_project_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Log name changes
  IF OLD.name IS DISTINCT FROM NEW.name THEN
    INSERT INTO public.project_audit_log (project_id, user_id, action, field_name, old_value, new_value)
    VALUES (NEW.id, auth.uid(), 'update', 'name', OLD.name, NEW.name);
  END IF;

  -- Log description changes
  IF OLD.description IS DISTINCT FROM NEW.description THEN
    INSERT INTO public.project_audit_log (project_id, user_id, action, field_name, old_value, new_value)
    VALUES (NEW.id, auth.uid(), 'update', 'description', OLD.description, NEW.description);
  END IF;

  -- Log objective changes
  IF OLD.objective IS DISTINCT FROM NEW.objective THEN
    INSERT INTO public.project_audit_log (project_id, user_id, action, field_name, old_value, new_value)
    VALUES (NEW.id, auth.uid(), 'update', 'objective', OLD.objective, NEW.objective);
  END IF;

  -- Log client changes
  IF OLD.client_id IS DISTINCT FROM NEW.client_id THEN
    INSERT INTO public.project_audit_log (project_id, user_id, action, field_name, old_value, new_value)
    VALUES (NEW.id, auth.uid(), 'update', 'client_id', OLD.client_id::TEXT, NEW.client_id::TEXT);
  END IF;

  -- Log account changes
  IF OLD.account_user_id IS DISTINCT FROM NEW.account_user_id THEN
    INSERT INTO public.project_audit_log (project_id, user_id, action, field_name, old_value, new_value)
    VALUES (NEW.id, auth.uid(), 'update', 'account_user_id', OLD.account_user_id::TEXT, NEW.account_user_id::TEXT);
  END IF;

  -- Log status changes
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.project_audit_log (project_id, user_id, action, field_name, old_value, new_value)
    VALUES (NEW.id, auth.uid(), 'update', 'status', OLD.status::TEXT, NEW.status::TEXT);
  END IF;

  -- Log discount changes
  IF OLD.discount_percentage IS DISTINCT FROM NEW.discount_percentage THEN
    INSERT INTO public.project_audit_log (project_id, user_id, action, field_name, old_value, new_value)
    VALUES (NEW.id, auth.uid(), 'update', 'discount_percentage', OLD.discount_percentage::TEXT, NEW.discount_percentage::TEXT);
  END IF;

  -- Log margin changes
  IF OLD.margin_percentage IS DISTINCT FROM NEW.margin_percentage THEN
    INSERT INTO public.project_audit_log (project_id, user_id, action, field_name, old_value, new_value)
    VALUES (NEW.id, auth.uid(), 'update', 'margin_percentage', OLD.margin_percentage::TEXT, NEW.margin_percentage::TEXT);
  END IF;

  -- Log project type changes
  IF OLD.project_type IS DISTINCT FROM NEW.project_type THEN
    INSERT INTO public.project_audit_log (project_id, user_id, action, field_name, old_value, new_value)
    VALUES (NEW.id, auth.uid(), 'update', 'project_type', OLD.project_type, NEW.project_type);
  END IF;

  RETURN NEW;
END;
$function$;

-- Create trigger for project updates
DROP TRIGGER IF EXISTS trigger_log_project_changes ON public.projects;
CREATE TRIGGER trigger_log_project_changes
AFTER UPDATE ON public.projects
FOR EACH ROW
EXECUTE FUNCTION public.log_project_change();

-- Create trigger for project creation
CREATE OR REPLACE FUNCTION public.log_project_creation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.project_audit_log (project_id, user_id, action, field_name, old_value, new_value)
  VALUES (NEW.id, auth.uid(), 'create', 'project', NULL, 'Progetto creato');
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trigger_log_project_creation ON public.projects;
CREATE TRIGGER trigger_log_project_creation
AFTER INSERT ON public.projects
FOR EACH ROW
EXECUTE FUNCTION public.log_project_creation();

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_project_audit_log_project_id ON public.project_audit_log(project_id);
CREATE INDEX IF NOT EXISTS idx_project_audit_log_created_at ON public.project_audit_log(created_at DESC);