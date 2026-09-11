CREATE OR REPLACE FUNCTION public.notify_budget_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_budget_name text;
  v_creator_id uuid;
  v_notification_project_id uuid;
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  v_budget_name := NEW.name;
  v_creator_id := NEW.user_id;
  v_notification_project_id := NEW.project_id;

  IF NEW.status = 'in_attesa' THEN
    INSERT INTO public.notifications (user_id, type, title, message, project_id, read)
    SELECT
      ur.user_id,
      'budget_pending',
      'Budget in attesa di approvazione',
      format('Il budget "%s" è in attesa di approvazione', v_budget_name),
      v_notification_project_id,
      false
    FROM public.user_roles ur
    JOIN public.profiles p ON p.id = ur.user_id
    WHERE ur.role IN ('admin', 'team_leader')
      AND p.approved = true
      AND p.deleted_at IS NULL
      AND ur.user_id IS DISTINCT FROM auth.uid();

  ELSIF NEW.status = 'approvato' THEN
    IF v_creator_id IS NOT NULL AND v_creator_id IS DISTINCT FROM auth.uid() THEN
      INSERT INTO public.notifications (user_id, type, title, message, project_id, read)
      VALUES (
        v_creator_id,
        'budget_approved',
        'Budget approvato',
        format('Il budget "%s" è stato approvato', v_budget_name),
        v_notification_project_id,
        false
      );
    END IF;

    IF NEW.account_user_id IS NOT NULL
       AND NEW.account_user_id IS DISTINCT FROM v_creator_id
       AND NEW.account_user_id IS DISTINCT FROM auth.uid() THEN
      INSERT INTO public.notifications (user_id, type, title, message, project_id, read)
      VALUES (
        NEW.account_user_id,
        'budget_approved',
        'Budget approvato',
        format('Il budget "%s" è stato approvato', v_budget_name),
        v_notification_project_id,
        false
      );
    END IF;

  ELSIF NEW.status = 'rifiutato' THEN
    IF v_creator_id IS NOT NULL AND v_creator_id IS DISTINCT FROM auth.uid() THEN
      INSERT INTO public.notifications (user_id, type, title, message, project_id, read)
      VALUES (
        v_creator_id,
        'budget_rejected',
        'Budget rifiutato',
        format('Il budget "%s" è stato rifiutato', v_budget_name),
        v_notification_project_id,
        false
      );
    END IF;

    IF NEW.account_user_id IS NOT NULL
       AND NEW.account_user_id IS DISTINCT FROM v_creator_id
       AND NEW.account_user_id IS DISTINCT FROM auth.uid() THEN
      INSERT INTO public.notifications (user_id, type, title, message, project_id, read)
      VALUES (
        NEW.account_user_id,
        'budget_rejected',
        'Budget rifiutato',
        format('Il budget "%s" è stato rifiutato', v_budget_name),
        v_notification_project_id,
        false
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;