CREATE OR REPLACE FUNCTION public.update_pack_project_progress()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_new_project UUID;
  v_old_project UUID;
BEGIN
  IF TG_OP IN ('UPDATE','DELETE') THEN
    SELECT bi.project_id INTO v_old_project FROM budget_items bi WHERE bi.id = OLD.budget_item_id;
  END IF;
  IF TG_OP IN ('INSERT','UPDATE') THEN
    SELECT bi.project_id INTO v_new_project FROM budget_items bi WHERE bi.id = NEW.budget_item_id;
  END IF;

  IF v_new_project IS NOT NULL THEN
    PERFORM public.recompute_project_progress(v_new_project, true);
  END IF;
  IF v_old_project IS NOT NULL AND v_old_project IS DISTINCT FROM v_new_project THEN
    PERFORM public.recompute_project_progress(v_old_project, true);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$function$;

SELECT public.recompute_project_progress(p.id, false)
FROM public.projects p
WHERE p.name IN ('YORU - Marketing operativo 2026', 'YORU - Lavorazioni grafiche (10 giornate)');