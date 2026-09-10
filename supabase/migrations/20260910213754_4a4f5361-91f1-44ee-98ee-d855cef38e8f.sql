-- Notifica assegnazione task
CREATE OR REPLACE FUNCTION public.notify_task_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _task RECORD;
  _project_name TEXT;
BEGIN
  SELECT t.id, t.title, t.project_id INTO _task
    FROM public.project_tasks t WHERE t.id = NEW.task_id;
  IF _task.id IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.user_id IS NULL OR NEW.user_id = auth.uid() THEN
    RETURN NEW;
  END IF;

  SELECT name INTO _project_name FROM public.projects WHERE id = _task.project_id;

  PERFORM public.notify_user_if_enabled(
    NEW.user_id,
    'task_assigned',
    'Nuova task assegnata',
    format('Ti è stata assegnata la task "%s"%s',
           _task.title,
           COALESCE(' nel progetto "' || _project_name || '"', '')),
    _task.project_id
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_task_assignment ON public.project_task_assignees;
CREATE TRIGGER trg_notify_task_assignment
AFTER INSERT ON public.project_task_assignees
FOR EACH ROW EXECUTE FUNCTION public.notify_task_assignment();

-- Notifica cambio stato / completamento task
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

DROP TRIGGER IF EXISTS trg_notify_task_status_change ON public.project_tasks;
CREATE TRIGGER trg_notify_task_status_change
AFTER UPDATE OF status ON public.project_tasks
FOR EACH ROW EXECUTE FUNCTION public.notify_task_status_change();

REVOKE EXECUTE ON FUNCTION public.notify_task_assignment() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.notify_task_status_change() FROM PUBLIC, anon;