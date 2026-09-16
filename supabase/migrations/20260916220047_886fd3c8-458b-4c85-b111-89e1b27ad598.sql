CREATE OR REPLACE FUNCTION public.complete_open_items_on_project_completion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM set_config('app.bulk_task_completion', 'on', true);

  UPDATE public.project_tasks
     SET status = 'done',
         completed_at = COALESCE(completed_at, now())
   WHERE project_id = NEW.id
     AND status <> 'done';

  PERFORM set_config('app.bulk_task_completion', 'off', true);

  BEGIN
    INSERT INTO public.user_activity_completions (user_id, budget_item_id, completed_at)
    SELECT bi.assignee_id::uuid, bi.id, now()
      FROM public.budget_items bi
     WHERE bi.project_id = NEW.id
       AND bi.assignee_id IS NOT NULL
       AND bi.assignee_id <> ''
       AND bi.assignee_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    ON CONFLICT (user_id, budget_item_id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'complete_open_items_on_project_completion: activity completions skipped (%)', SQLERRM;
  END;

  RETURN NEW;
END;
$function$;