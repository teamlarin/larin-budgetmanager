-- Update the function to use billing_type instead of project_type
-- and calculate total hours from budget_items hours_worked
CREATE OR REPLACE FUNCTION public.update_pack_project_progress()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_project_id UUID;
  v_billing_type TEXT;
  v_total_hours NUMERIC;
  v_confirmed_hours NUMERIC;
  v_new_progress NUMERIC;
BEGIN
  -- Get the project_id from the budget_item
  IF TG_OP = 'DELETE' THEN
    SELECT bi.project_id INTO v_project_id
    FROM budget_items bi
    WHERE bi.id = OLD.budget_item_id;
  ELSE
    SELECT bi.project_id INTO v_project_id
    FROM budget_items bi
    WHERE bi.id = NEW.budget_item_id;
  END IF;

  IF v_project_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Get project billing_type
  SELECT billing_type
  INTO v_billing_type
  FROM projects
  WHERE id = v_project_id;

  -- Only proceed if billing_type is 'pack'
  IF v_billing_type IS NULL OR v_billing_type != 'pack' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Calculate total planned hours from budget_items (excluding products)
  SELECT COALESCE(SUM(bi.hours_worked), 0)
  INTO v_total_hours
  FROM budget_items bi
  WHERE bi.project_id = v_project_id
    AND (bi.is_product IS NULL OR bi.is_product = false);

  -- Calculate confirmed hours from time tracking
  SELECT COALESCE(SUM(
    EXTRACT(EPOCH FROM (att.actual_end_time - att.actual_start_time)) / 3600.0
  ), 0)
  INTO v_confirmed_hours
  FROM activity_time_tracking att
  JOIN budget_items bi ON bi.id = att.budget_item_id
  WHERE bi.project_id = v_project_id
    AND att.actual_start_time IS NOT NULL
    AND att.actual_end_time IS NOT NULL;

  -- Calculate progress: confirmed hours / planned hours
  IF v_total_hours IS NOT NULL AND v_total_hours > 0 THEN
    v_new_progress := LEAST(ROUND((v_confirmed_hours / v_total_hours) * 100), 100);
  ELSE
    v_new_progress := 0;
  END IF;

  UPDATE projects SET progress = v_new_progress WHERE id = v_project_id;

  RETURN COALESCE(NEW, OLD);
END;
$function$;