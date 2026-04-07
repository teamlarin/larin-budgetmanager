
CREATE OR REPLACE FUNCTION public.notify_budget_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_in_app_enabled boolean;
BEGIN
  IF OLD.assigned_user_id IS NOT DISTINCT FROM NEW.assigned_user_id THEN
    RETURN NEW;
  END IF;

  IF NEW.assigned_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Skip self-assignment
  IF NEW.assigned_user_id = NEW.user_id THEN
    RETURN NEW;
  END IF;

  -- Check notification preferences
  SELECT COALESCE(np.in_app_enabled, true)
  INTO v_in_app_enabled
  FROM notification_preferences np
  WHERE np.user_id = NEW.assigned_user_id
    AND np.notification_type = 'budget_assigned';

  IF v_in_app_enabled IS NULL THEN
    v_in_app_enabled := true;
  END IF;

  IF NOT v_in_app_enabled THEN
    RETURN NEW;
  END IF;

  INSERT INTO notifications (user_id, type, title, message)
  VALUES (
    NEW.assigned_user_id,
    'budget_assigned',
    'Budget assegnato',
    'Ti è stato assegnato il budget "' || NEW.name || '"'
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_notify_budget_assignment
  AFTER UPDATE ON budgets
  FOR EACH ROW
  EXECUTE FUNCTION notify_budget_assignment();
