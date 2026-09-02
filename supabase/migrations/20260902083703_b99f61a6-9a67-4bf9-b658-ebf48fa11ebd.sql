-- Shared calculation routine
CREATE OR REPLACE FUNCTION public.recompute_project_progress(p_project_id uuid, p_notify boolean DEFAULT true)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_billing_type TEXT;
  v_total_hours NUMERIC;
  v_confirmed_hours NUMERIC;
  v_new_progress NUMERIC;
  v_old_progress NUMERIC;
  v_project_leader_id UUID;
  v_project_name TEXT;
  v_notification_exists BOOLEAN;
BEGIN
  IF p_project_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT billing_type, progress, project_leader_id, name
  INTO v_billing_type, v_old_progress, v_project_leader_id, v_project_name
  FROM projects
  WHERE id = p_project_id;

  IF v_billing_type IS NULL OR v_billing_type NOT IN ('pack', 'recurring') THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(SUM(bi.hours_worked), 0)
  INTO v_total_hours
  FROM budget_items bi
  WHERE bi.project_id = p_project_id
    AND (bi.is_product IS NULL OR bi.is_product = false);

  SELECT COALESCE(SUM(
    ABS(EXTRACT(EPOCH FROM (att.actual_end_time - att.actual_start_time))) / 3600.0
  ), 0)
  INTO v_confirmed_hours
  FROM activity_time_tracking att
  JOIN budget_items bi ON bi.id = att.budget_item_id
  WHERE bi.project_id = p_project_id
    AND att.actual_start_time IS NOT NULL
    AND att.actual_end_time IS NOT NULL;

  IF v_total_hours IS NOT NULL AND v_total_hours > 0 THEN
    v_new_progress := ROUND((v_confirmed_hours / v_total_hours) * 100);
  ELSE
    v_new_progress := 0;
  END IF;

  UPDATE projects SET progress = v_new_progress
  WHERE id = p_project_id
    AND COALESCE(progress, -1) IS DISTINCT FROM v_new_progress;

  IF p_notify AND v_project_leader_id IS NOT NULL THEN
    IF COALESCE(v_old_progress, 0) < 90 AND v_new_progress >= 90 THEN
      SELECT EXISTS(
        SELECT 1 FROM notifications
        WHERE project_id = p_project_id
          AND type = 'pack_hours_warning'
          AND created_at > NOW() - INTERVAL '7 days'
      ) INTO v_notification_exists;

      IF NOT v_notification_exists THEN
        INSERT INTO public.notifications (user_id, type, title, message, project_id, read)
        VALUES (v_project_leader_id, 'pack_hours_warning', 'Attenzione: ore al 90%',
          format('Il progetto "%s" ha raggiunto il 90%% delle ore previste (%s/%s ore)',
            v_project_name, ROUND(v_confirmed_hours::numeric, 1), ROUND(v_total_hours::numeric, 1)),
          p_project_id, false);
      END IF;
    END IF;

    IF COALESCE(v_old_progress, 0) < 100 AND v_new_progress >= 100 THEN
      SELECT EXISTS(
        SELECT 1 FROM notifications
        WHERE project_id = p_project_id
          AND type = 'pack_hours_overtime'
          AND created_at > NOW() - INTERVAL '7 days'
      ) INTO v_notification_exists;

      IF NOT v_notification_exists THEN
        INSERT INTO public.notifications (user_id, type, title, message, project_id, read)
        VALUES (v_project_leader_id, 'pack_hours_overtime', '⚠️ Sforamento ore',
          format('Il progetto "%s" ha superato le ore previste! (%s/%s ore - %s%%)',
            v_project_name, ROUND(v_confirmed_hours::numeric, 1), ROUND(v_total_hours::numeric, 1), v_new_progress),
          p_project_id, false);
      END IF;
    END IF;
  END IF;

  RETURN v_new_progress;
END;
$function$;

REVOKE ALL ON FUNCTION public.recompute_project_progress(uuid, boolean) FROM PUBLIC, anon, authenticated;

-- Time tracking trigger now delegates to the shared routine
CREATE OR REPLACE FUNCTION public.update_pack_project_progress()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_project_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    SELECT bi.project_id INTO v_project_id FROM budget_items bi WHERE bi.id = OLD.budget_item_id;
  ELSE
    SELECT bi.project_id INTO v_project_id FROM budget_items bi WHERE bi.id = NEW.budget_item_id;
  END IF;

  IF v_project_id IS NOT NULL THEN
    PERFORM public.recompute_project_progress(v_project_id, true);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- New trigger: recompute when planned hours change on budget items
CREATE OR REPLACE FUNCTION public.update_progress_on_budget_item_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.project_id IS NOT NULL THEN
      PERFORM public.recompute_project_progress(OLD.project_id, true);
    END IF;
    RETURN OLD;
  END IF;

  IF NEW.project_id IS NOT NULL THEN
    PERFORM public.recompute_project_progress(NEW.project_id, true);
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.project_id IS NOT NULL AND OLD.project_id IS DISTINCT FROM NEW.project_id THEN
    PERFORM public.recompute_project_progress(OLD.project_id, true);
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trigger_update_progress_on_budget_item ON public.budget_items;
CREATE TRIGGER trigger_update_progress_on_budget_item
AFTER INSERT OR DELETE OR UPDATE OF hours_worked, is_product, project_id
ON public.budget_items
FOR EACH ROW EXECUTE FUNCTION public.update_progress_on_budget_item_change();

-- Bulk recalculation uses the shared routine
CREATE OR REPLACE FUNCTION public.recalculate_all_pack_projects_progress()
RETURNS TABLE(project_id uuid, project_name text, old_progress numeric, new_progress numeric, planned_hours numeric, confirmed_hours numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_project RECORD;
  v_planned NUMERIC;
  v_confirmed NUMERIC;
  v_old NUMERIC;
  v_new NUMERIC;
BEGIN
  FOR v_project IN
    SELECT p.id, p.name, p.progress
    FROM projects p
    WHERE p.billing_type IN ('pack', 'recurring')
      AND p.status = 'approvato'
      AND (p.project_status IS NULL OR p.project_status != 'completato')
  LOOP
    v_old := v_project.progress;

    SELECT COALESCE(SUM(bi.hours_worked), 0) INTO v_planned
    FROM budget_items bi
    WHERE bi.project_id = v_project.id
      AND (bi.is_product IS NULL OR bi.is_product = false);

    SELECT COALESCE(SUM(
      ABS(EXTRACT(EPOCH FROM (att.actual_end_time - att.actual_start_time))) / 3600.0
    ), 0) INTO v_confirmed
    FROM activity_time_tracking att
    JOIN budget_items bi ON bi.id = att.budget_item_id
    WHERE bi.project_id = v_project.id
      AND att.actual_start_time IS NOT NULL
      AND att.actual_end_time IS NOT NULL;

    v_new := public.recompute_project_progress(v_project.id, false);

    RETURN QUERY SELECT v_project.id, v_project.name, v_old, v_new, v_planned, ROUND(v_confirmed::numeric, 2);
  END LOOP;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.recalculate_all_pack_projects_progress() TO authenticated;

-- Realign existing data (no notifications)
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.id FROM projects p
    WHERE p.billing_type IN ('pack', 'recurring')
      AND p.status = 'approvato'
      AND (p.project_status IS NULL OR p.project_status != 'completato')
  LOOP
    PERFORM public.recompute_project_progress(r.id, false);
  END LOOP;
END $$;