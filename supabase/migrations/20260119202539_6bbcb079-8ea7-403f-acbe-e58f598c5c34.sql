-- Create budget_audit_log table
CREATE TABLE public.budget_audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  budget_id UUID NOT NULL REFERENCES public.budgets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  action TEXT NOT NULL,
  field_name TEXT,
  old_value TEXT,
  new_value TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.budget_audit_log ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Approved users can view budget audit logs"
  ON public.budget_audit_log FOR SELECT
  USING (public.is_approved_user(auth.uid()));

CREATE POLICY "System can insert budget audit logs"
  ON public.budget_audit_log FOR INSERT
  WITH CHECK (true);

-- Create index for faster queries
CREATE INDEX idx_budget_audit_log_budget_id ON public.budget_audit_log(budget_id);
CREATE INDEX idx_budget_audit_log_created_at ON public.budget_audit_log(created_at DESC);

-- Create function to log budget creation
CREATE OR REPLACE FUNCTION public.log_budget_creation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.budget_audit_log (budget_id, user_id, action, field_name, old_value, new_value)
  VALUES (NEW.id, COALESCE(auth.uid(), NEW.user_id), 'create', 'budget', NULL, 'Budget creato');
  RETURN NEW;
END;
$$;

-- Create function to log budget changes
CREATE OR REPLACE FUNCTION public.log_budget_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Log name changes
  IF OLD.name IS DISTINCT FROM NEW.name THEN
    INSERT INTO public.budget_audit_log (budget_id, user_id, action, field_name, old_value, new_value)
    VALUES (NEW.id, auth.uid(), 'update', 'name', OLD.name, NEW.name);
  END IF;

  -- Log description changes
  IF OLD.description IS DISTINCT FROM NEW.description THEN
    INSERT INTO public.budget_audit_log (budget_id, user_id, action, field_name, old_value, new_value)
    VALUES (NEW.id, auth.uid(), 'update', 'description', OLD.description, NEW.description);
  END IF;

  -- Log objective changes
  IF OLD.objective IS DISTINCT FROM NEW.objective THEN
    INSERT INTO public.budget_audit_log (budget_id, user_id, action, field_name, old_value, new_value)
    VALUES (NEW.id, auth.uid(), 'update', 'objective', OLD.objective, NEW.objective);
  END IF;

  -- Log client changes
  IF OLD.client_id IS DISTINCT FROM NEW.client_id THEN
    INSERT INTO public.budget_audit_log (budget_id, user_id, action, field_name, old_value, new_value)
    VALUES (NEW.id, auth.uid(), 'update', 'client_id', OLD.client_id::TEXT, NEW.client_id::TEXT);
  END IF;

  -- Log account changes
  IF OLD.account_user_id IS DISTINCT FROM NEW.account_user_id THEN
    INSERT INTO public.budget_audit_log (budget_id, user_id, action, field_name, old_value, new_value)
    VALUES (NEW.id, auth.uid(), 'update', 'account_user_id', OLD.account_user_id::TEXT, NEW.account_user_id::TEXT);
  END IF;

  -- Log status changes
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.budget_audit_log (budget_id, user_id, action, field_name, old_value, new_value)
    VALUES (NEW.id, auth.uid(), 'update', 'status', OLD.status::TEXT, NEW.status::TEXT);
  END IF;

  -- Log discount changes
  IF OLD.discount_percentage IS DISTINCT FROM NEW.discount_percentage THEN
    INSERT INTO public.budget_audit_log (budget_id, user_id, action, field_name, old_value, new_value)
    VALUES (NEW.id, auth.uid(), 'update', 'discount_percentage', OLD.discount_percentage::TEXT, NEW.discount_percentage::TEXT);
  END IF;

  -- Log margin changes
  IF OLD.margin_percentage IS DISTINCT FROM NEW.margin_percentage THEN
    INSERT INTO public.budget_audit_log (budget_id, user_id, action, field_name, old_value, new_value)
    VALUES (NEW.id, auth.uid(), 'update', 'margin_percentage', OLD.margin_percentage::TEXT, NEW.margin_percentage::TEXT);
  END IF;

  -- Log project type changes
  IF OLD.project_type IS DISTINCT FROM NEW.project_type THEN
    INSERT INTO public.budget_audit_log (budget_id, user_id, action, field_name, old_value, new_value)
    VALUES (NEW.id, auth.uid(), 'update', 'project_type', OLD.project_type, NEW.project_type);
  END IF;

  -- Log brief link changes
  IF OLD.brief_link IS DISTINCT FROM NEW.brief_link THEN
    INSERT INTO public.budget_audit_log (budget_id, user_id, action, field_name, old_value, new_value)
    VALUES (NEW.id, auth.uid(), 'update', 'brief_link', OLD.brief_link, NEW.brief_link);
  END IF;

  -- Log total budget changes
  IF OLD.total_budget IS DISTINCT FROM NEW.total_budget THEN
    INSERT INTO public.budget_audit_log (budget_id, user_id, action, field_name, old_value, new_value)
    VALUES (NEW.id, auth.uid(), 'update', 'total_budget', OLD.total_budget::TEXT, NEW.total_budget::TEXT);
  END IF;

  -- Log total hours changes
  IF OLD.total_hours IS DISTINCT FROM NEW.total_hours THEN
    INSERT INTO public.budget_audit_log (budget_id, user_id, action, field_name, old_value, new_value)
    VALUES (NEW.id, auth.uid(), 'update', 'total_hours', OLD.total_hours::TEXT, NEW.total_hours::TEXT);
  END IF;

  RETURN NEW;
END;
$$;

-- Create triggers
CREATE TRIGGER trigger_log_budget_creation
  AFTER INSERT ON public.budgets
  FOR EACH ROW
  EXECUTE FUNCTION public.log_budget_creation();

CREATE TRIGGER trigger_log_budget_change
  AFTER UPDATE ON public.budgets
  FOR EACH ROW
  EXECUTE FUNCTION public.log_budget_change();