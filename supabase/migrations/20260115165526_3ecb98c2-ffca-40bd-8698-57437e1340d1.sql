-- Update the pack project progress function to send notification at 90%
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
  v_old_progress NUMERIC;
  v_project_leader_id UUID;
  v_project_name TEXT;
  v_notification_exists BOOLEAN;
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

  -- Get project info
  SELECT billing_type, progress, project_leader_id, name
  INTO v_billing_type, v_old_progress, v_project_leader_id, v_project_name
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

  -- Calculate progress: confirmed hours / planned hours (allow > 100%)
  IF v_total_hours IS NOT NULL AND v_total_hours > 0 THEN
    v_new_progress := ROUND((v_confirmed_hours / v_total_hours) * 100);
  ELSE
    v_new_progress := 0;
  END IF;

  -- Update project progress
  UPDATE projects SET progress = v_new_progress WHERE id = v_project_id;

  -- Send notification when crossing 90% threshold
  IF v_old_progress < 90 AND v_new_progress >= 90 AND v_project_leader_id IS NOT NULL THEN
    -- Check if notification already exists for this project and type
    SELECT EXISTS(
      SELECT 1 FROM notifications 
      WHERE project_id = v_project_id 
        AND type = 'pack_hours_warning'
        AND created_at > NOW() - INTERVAL '7 days'
    ) INTO v_notification_exists;
    
    -- Only send if no recent notification
    IF NOT v_notification_exists THEN
      INSERT INTO public.notifications (
        user_id,
        type,
        title,
        message,
        project_id,
        read
      ) VALUES (
        v_project_leader_id,
        'pack_hours_warning',
        'Attenzione: ore pack al 90%',
        format('Il progetto "%s" ha raggiunto il 90%% delle ore previste (%s/%s ore)', 
          v_project_name, 
          ROUND(v_confirmed_hours::numeric, 1), 
          ROUND(v_total_hours::numeric, 1)),
        v_project_id,
        false
      );
    END IF;
  END IF;

  -- Also notify at 100% (overtime)
  IF v_old_progress < 100 AND v_new_progress >= 100 AND v_project_leader_id IS NOT NULL THEN
    SELECT EXISTS(
      SELECT 1 FROM notifications 
      WHERE project_id = v_project_id 
        AND type = 'pack_hours_overtime'
        AND created_at > NOW() - INTERVAL '7 days'
    ) INTO v_notification_exists;
    
    IF NOT v_notification_exists THEN
      INSERT INTO public.notifications (
        user_id,
        type,
        title,
        message,
        project_id,
        read
      ) VALUES (
        v_project_leader_id,
        'pack_hours_overtime',
        '⚠️ Sforamento ore pack',
        format('Il progetto "%s" ha superato le ore previste! (%s/%s ore - %s%%)', 
          v_project_name, 
          ROUND(v_confirmed_hours::numeric, 1), 
          ROUND(v_total_hours::numeric, 1),
          v_new_progress),
        v_project_id,
        false
      );
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$function$;