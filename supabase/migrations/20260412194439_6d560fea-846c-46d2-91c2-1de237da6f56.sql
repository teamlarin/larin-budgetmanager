CREATE OR REPLACE FUNCTION public.recalculate_all_pack_projects_progress()
 RETURNS TABLE(project_id uuid, project_name text, old_progress numeric, new_progress numeric, planned_hours numeric, confirmed_hours numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_project RECORD;
  v_planned_hours NUMERIC;
  v_confirmed_hours NUMERIC;
  v_new_progress NUMERIC;
BEGIN
  FOR v_project IN 
    SELECT p.id, p.name, p.progress, p.billing_type
    FROM projects p
    WHERE p.billing_type IN ('pack', 'recurring')
      AND p.status = 'approvato'
      AND (p.project_status IS NULL OR p.project_status != 'completato')
  LOOP
    SELECT COALESCE(SUM(bi.hours_worked), 0)
    INTO v_planned_hours
    FROM budget_items bi
    WHERE bi.project_id = v_project.id
      AND (bi.is_product IS NULL OR bi.is_product = false);

    SELECT COALESCE(SUM(
      ABS(EXTRACT(EPOCH FROM (att.actual_end_time - att.actual_start_time))) / 3600.0
    ), 0)
    INTO v_confirmed_hours
    FROM activity_time_tracking att
    JOIN budget_items bi ON bi.id = att.budget_item_id
    WHERE bi.project_id = v_project.id
      AND att.actual_start_time IS NOT NULL
      AND att.actual_end_time IS NOT NULL;

    IF v_planned_hours IS NOT NULL AND v_planned_hours > 0 THEN
      v_new_progress := ROUND((v_confirmed_hours / v_planned_hours) * 100);
    ELSE
      v_new_progress := 0;
    END IF;

    UPDATE projects SET progress = v_new_progress WHERE id = v_project.id;

    project_id := v_project.id;
    project_name := v_project.name;
    old_progress := v_project.progress;
    new_progress := v_new_progress;
    planned_hours := v_planned_hours;
    confirmed_hours := v_confirmed_hours;
    RETURN NEXT;
  END LOOP;
END;
$function$;