-- Create budget_items_audit_log table
CREATE TABLE public.budget_items_audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  budget_item_id UUID NOT NULL,
  budget_id UUID,
  project_id UUID,
  user_id UUID NOT NULL,
  action TEXT NOT NULL,
  field_name TEXT,
  old_value TEXT,
  new_value TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.budget_items_audit_log ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Approved users can view budget items audit logs"
  ON public.budget_items_audit_log FOR SELECT
  USING (public.is_approved_user(auth.uid()));

CREATE POLICY "System can insert budget items audit logs"
  ON public.budget_items_audit_log FOR INSERT
  WITH CHECK (true);

-- Create indexes for faster queries
CREATE INDEX idx_budget_items_audit_log_budget_id ON public.budget_items_audit_log(budget_id);
CREATE INDEX idx_budget_items_audit_log_project_id ON public.budget_items_audit_log(project_id);
CREATE INDEX idx_budget_items_audit_log_budget_item_id ON public.budget_items_audit_log(budget_item_id);
CREATE INDEX idx_budget_items_audit_log_created_at ON public.budget_items_audit_log(created_at DESC);

-- Create function to log budget item creation
CREATE OR REPLACE FUNCTION public.log_budget_item_creation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.budget_items_audit_log (budget_item_id, budget_id, project_id, user_id, action, field_name, old_value, new_value)
  VALUES (NEW.id, NEW.budget_id, NEW.project_id, COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid), 'create', 'activity', NULL, NEW.activity_name);
  RETURN NEW;
END;
$$;

-- Create function to log budget item changes
CREATE OR REPLACE FUNCTION public.log_budget_item_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid);

  -- Log activity name changes
  IF OLD.activity_name IS DISTINCT FROM NEW.activity_name THEN
    INSERT INTO public.budget_items_audit_log (budget_item_id, budget_id, project_id, user_id, action, field_name, old_value, new_value)
    VALUES (NEW.id, NEW.budget_id, NEW.project_id, v_user_id, 'update', 'activity_name', OLD.activity_name, NEW.activity_name);
  END IF;

  -- Log category changes
  IF OLD.category IS DISTINCT FROM NEW.category THEN
    INSERT INTO public.budget_items_audit_log (budget_item_id, budget_id, project_id, user_id, action, field_name, old_value, new_value)
    VALUES (NEW.id, NEW.budget_id, NEW.project_id, v_user_id, 'update', 'category', OLD.category, NEW.category);
  END IF;

  -- Log hours worked changes
  IF OLD.hours_worked IS DISTINCT FROM NEW.hours_worked THEN
    INSERT INTO public.budget_items_audit_log (budget_item_id, budget_id, project_id, user_id, action, field_name, old_value, new_value)
    VALUES (NEW.id, NEW.budget_id, NEW.project_id, v_user_id, 'update', 'hours_worked', OLD.hours_worked::TEXT, NEW.hours_worked::TEXT);
  END IF;

  -- Log hourly rate changes
  IF OLD.hourly_rate IS DISTINCT FROM NEW.hourly_rate THEN
    INSERT INTO public.budget_items_audit_log (budget_item_id, budget_id, project_id, user_id, action, field_name, old_value, new_value)
    VALUES (NEW.id, NEW.budget_id, NEW.project_id, v_user_id, 'update', 'hourly_rate', OLD.hourly_rate::TEXT, NEW.hourly_rate::TEXT);
  END IF;

  -- Log total cost changes
  IF OLD.total_cost IS DISTINCT FROM NEW.total_cost THEN
    INSERT INTO public.budget_items_audit_log (budget_item_id, budget_id, project_id, user_id, action, field_name, old_value, new_value)
    VALUES (NEW.id, NEW.budget_id, NEW.project_id, v_user_id, 'update', 'total_cost', OLD.total_cost::TEXT, NEW.total_cost::TEXT);
  END IF;

  -- Log assignee changes
  IF OLD.assignee_id IS DISTINCT FROM NEW.assignee_id THEN
    INSERT INTO public.budget_items_audit_log (budget_item_id, budget_id, project_id, user_id, action, field_name, old_value, new_value)
    VALUES (NEW.id, NEW.budget_id, NEW.project_id, v_user_id, 'update', 'assignee_id', OLD.assignee_id, NEW.assignee_id);
  END IF;

  -- Log assignee name changes
  IF OLD.assignee_name IS DISTINCT FROM NEW.assignee_name THEN
    INSERT INTO public.budget_items_audit_log (budget_item_id, budget_id, project_id, user_id, action, field_name, old_value, new_value)
    VALUES (NEW.id, NEW.budget_id, NEW.project_id, v_user_id, 'update', 'assignee_name', OLD.assignee_name, NEW.assignee_name);
  END IF;

  -- Log duration days changes
  IF OLD.duration_days IS DISTINCT FROM NEW.duration_days THEN
    INSERT INTO public.budget_items_audit_log (budget_item_id, budget_id, project_id, user_id, action, field_name, old_value, new_value)
    VALUES (NEW.id, NEW.budget_id, NEW.project_id, v_user_id, 'update', 'duration_days', OLD.duration_days::TEXT, NEW.duration_days::TEXT);
  END IF;

  -- Log start day offset changes
  IF OLD.start_day_offset IS DISTINCT FROM NEW.start_day_offset THEN
    INSERT INTO public.budget_items_audit_log (budget_item_id, budget_id, project_id, user_id, action, field_name, old_value, new_value)
    VALUES (NEW.id, NEW.budget_id, NEW.project_id, v_user_id, 'update', 'start_day_offset', OLD.start_day_offset::TEXT, NEW.start_day_offset::TEXT);
  END IF;

  RETURN NEW;
END;
$$;

-- Create function to log budget item deletion
CREATE OR REPLACE FUNCTION public.log_budget_item_deletion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.budget_items_audit_log (budget_item_id, budget_id, project_id, user_id, action, field_name, old_value, new_value)
  VALUES (OLD.id, OLD.budget_id, OLD.project_id, COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid), 'delete', 'activity', OLD.activity_name, NULL);
  RETURN OLD;
END;
$$;

-- Create triggers
CREATE TRIGGER trigger_log_budget_item_creation
  AFTER INSERT ON public.budget_items
  FOR EACH ROW
  EXECUTE FUNCTION public.log_budget_item_creation();

CREATE TRIGGER trigger_log_budget_item_change
  AFTER UPDATE ON public.budget_items
  FOR EACH ROW
  EXECUTE FUNCTION public.log_budget_item_change();

CREATE TRIGGER trigger_log_budget_item_deletion
  BEFORE DELETE ON public.budget_items
  FOR EACH ROW
  EXECUTE FUNCTION public.log_budget_item_deletion();