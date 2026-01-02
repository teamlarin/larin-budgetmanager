-- Update function to check for pack in name OR Automation in project_type
CREATE OR REPLACE FUNCTION public.update_pack_project_progress()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_project_id UUID;
  v_project_type TEXT;
  v_project_name TEXT;
  v_total_hours NUMERIC;
  v_confirmed_hours NUMERIC;
  v_new_progress NUMERIC;
  v_is_pack_project BOOLEAN;
BEGIN
  -- Get the project_id from the budget_item
  -- Handle both INSERT/UPDATE (NEW) and DELETE (OLD)
  IF TG_OP = 'DELETE' THEN
    SELECT bi.project_id INTO v_project_id
    FROM budget_items bi
    WHERE bi.id = OLD.budget_item_id;
  ELSE
    SELECT bi.project_id INTO v_project_id
    FROM budget_items bi
    WHERE bi.id = NEW.budget_item_id;
  END IF;

  -- If no project found, exit
  IF v_project_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Check if the project is a pack type
  SELECT project_type, total_hours, name
  INTO v_project_type, v_total_hours, v_project_name
  FROM projects
  WHERE id = v_project_id;

  -- Check if it's a pack project (by name containing 'pack' OR project_type containing 'automation')
  v_is_pack_project := (
    LOWER(COALESCE(v_project_type, '')) LIKE '%pack%' OR
    LOWER(COALESCE(v_project_name, '')) LIKE '%pack%' OR
    LOWER(COALESCE(v_project_type, '')) LIKE '%automation%'
  );

  -- Only proceed if it's a pack project
  IF NOT v_is_pack_project THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Calculate confirmed hours for this project
  SELECT COALESCE(SUM(
    EXTRACT(EPOCH FROM (att.actual_end_time - att.actual_start_time)) / 3600.0
  ), 0)
  INTO v_confirmed_hours
  FROM activity_time_tracking att
  JOIN budget_items bi ON bi.id = att.budget_item_id
  WHERE bi.project_id = v_project_id
    AND att.actual_start_time IS NOT NULL
    AND att.actual_end_time IS NOT NULL;

  -- Calculate new progress percentage
  IF v_total_hours IS NOT NULL AND v_total_hours > 0 THEN
    v_new_progress := ROUND((v_confirmed_hours / v_total_hours) * 100);
    -- Cap at 100%
    IF v_new_progress > 100 THEN
      v_new_progress := 100;
    END IF;
  ELSE
    v_new_progress := 0;
  END IF;

  -- Update the project progress
  UPDATE projects
  SET progress = v_new_progress
  WHERE id = v_project_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;