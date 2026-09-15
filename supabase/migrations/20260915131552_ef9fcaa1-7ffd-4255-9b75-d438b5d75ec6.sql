CREATE OR REPLACE FUNCTION public.notify_task_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _project_name TEXT;
  _leader UUID;
  _actor UUID := auth.uid();
  _recipient UUID;
  _type TEXT;
  _title TEXT;
  _message TEXT;
  _status_label TEXT;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  -- Skip notifications during bulk completion triggered by project completion
  IF COALESCE(current_setting('app.bulk_task_completion', true), '') = 'on' THEN
    RETURN NEW;
  END IF;

  SELECT name, project_leader_id INTO _project_name, _leader
    FROM public.projects WHERE id = NEW.project_id;

  _status_label := CASE NEW.status
    WHEN 'backlog' THEN 'Backlog'
    WHEN 'todo' THEN 'Da fare'
    WHEN 'in_progress' THEN 'In corso'
    WHEN 'done' THEN 'Completata'
    WHEN 'blocked' THEN 'Bloccata'
    ELSE NEW.status
  END;

  IF NEW.status = 'done' THEN
    _type := 'task_completed';
    _title := 'Task completata';
    _message := format('La task "%s"%s è stata completata.',
      NEW.title, COALESCE(' del progetto "' || _project_name || '"', ''));
  ELSE
    _type := 'task_status_changed';
    _title := 'Stato task aggiornato';
    _message := format('La task "%s"%s è passata allo stato "%s".',
      NEW.title, COALESCE(' del progetto "' || _project_name || '"', ''), _status_label);
  END IF;

  FOR _recipient IN
    SELECT DISTINCT u FROM (
      SELECT a.user_id AS u FROM public.project_task_assignees a WHERE a.task_id = NEW.id
      UNION
      SELECT _leader
    ) s
    WHERE u IS NOT NULL AND (_actor IS NULL OR u <> _actor)
  LOOP
    PERFORM public.notify_user_if_enabled(_recipient, _type, _title, _message, NEW.project_id);
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_open_items_on_project_completion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM set_config('app.bulk_task_completion', 'on', true);

  UPDATE public.project_tasks
     SET status = 'done',
         completed_at = COALESCE(completed_at, now())
   WHERE project_id = NEW.id
     AND status <> 'done';

  PERFORM set_config('app.bulk_task_completion', 'off', true);

  INSERT INTO public.user_activity_completions (user_id, budget_item_id, completed_at)
  SELECT bi.assignee_id, bi.id, now()
    FROM public.budget_items bi
   WHERE bi.project_id = NEW.id
     AND bi.assignee_id IS NOT NULL
  ON CONFLICT (user_id, budget_item_id) DO NOTHING;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_open_items_on_project_completion() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_complete_open_items_on_project_completion ON public.projects;
CREATE TRIGGER trg_complete_open_items_on_project_completion
AFTER UPDATE OF project_status ON public.projects
FOR EACH ROW
WHEN (NEW.project_status = 'completato' AND OLD.project_status IS DISTINCT FROM NEW.project_status)
EXECUTE FUNCTION public.complete_open_items_on_project_completion();