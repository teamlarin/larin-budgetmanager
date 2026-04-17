-- Fix notify_project_leader_assignment to handle missing GUC settings safely
CREATE OR REPLACE FUNCTION public.notify_project_leader_assignment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_project_name TEXT;
  v_client_name TEXT;
  v_current_user_id UUID;
  v_new_leader_name TEXT;
  v_in_app_enabled BOOLEAN;
  v_email_enabled BOOLEAN;
  v_supabase_url TEXT;
  v_service_key TEXT;
BEGIN
  v_current_user_id := auth.uid();

  IF (TG_OP = 'INSERT' AND NEW.user_id IS NOT NULL) OR
     (TG_OP = 'UPDATE' AND OLD.user_id IS DISTINCT FROM NEW.user_id AND NEW.user_id IS NOT NULL) THEN

    IF NEW.user_id = v_current_user_id THEN
      RETURN NEW;
    END IF;

    SELECT
      COALESCE(in_app_enabled, true),
      COALESCE(email_enabled, true)
    INTO v_in_app_enabled, v_email_enabled
    FROM notification_preferences
    WHERE user_id = NEW.user_id AND notification_type = 'project_leader_assigned';

    v_in_app_enabled := COALESCE(v_in_app_enabled, true);
    v_email_enabled := COALESCE(v_email_enabled, true);

    v_project_name := NEW.name;

    IF NEW.client_id IS NOT NULL THEN
      SELECT name INTO v_client_name
      FROM clients
      WHERE id = NEW.client_id;
    END IF;

    SELECT COALESCE(first_name || ' ' || last_name, first_name, email, 'Utente')
    INTO v_new_leader_name
    FROM profiles
    WHERE id = NEW.user_id;

    IF v_in_app_enabled THEN
      INSERT INTO public.notifications (
        user_id, type, title, message, project_id, read
      ) VALUES (
        NEW.user_id,
        'project_leader_assigned',
        'Sei stato assegnato come Project Leader',
        format('Sei stato assegnato come Project Leader del progetto "%s"%s',
          v_project_name,
          CASE WHEN v_client_name IS NOT NULL THEN format(' per il cliente %s', v_client_name) ELSE '' END
        ),
        NEW.id,
        false
      );
    END IF;

    -- Resilient email notification: only call if GUC settings are configured
    IF v_email_enabled THEN
      v_supabase_url := current_setting('app.settings.supabase_url', true);
      v_service_key := current_setting('app.settings.service_role_key', true);

      IF v_supabase_url IS NOT NULL AND v_supabase_url <> ''
         AND v_service_key IS NOT NULL AND v_service_key <> '' THEN
        BEGIN
          PERFORM net.http_post(
            url := v_supabase_url || '/functions/v1/send-leader-notification',
            headers := jsonb_build_object(
              'Content-Type', 'application/json',
              'Authorization', 'Bearer ' || v_service_key
            ),
            body := jsonb_build_object(
              'user_id', NEW.user_id::text,
              'project_id', NEW.id::text,
              'project_name', v_project_name,
              'client_name', v_client_name
            )
          );
        EXCEPTION WHEN OTHERS THEN
          RAISE WARNING 'Email notification failed: %', SQLERRM;
        END;
      ELSE
        RAISE WARNING 'Skipping email notification: app.settings.supabase_url or service_role_key not configured';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error in notify_project_leader_assignment: %', SQLERRM;
    RETURN NEW;
END;
$function$;

-- Fix notify_project_completed_webhook similarly
CREATE OR REPLACE FUNCTION public.notify_project_completed_webhook()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_service_key TEXT;
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'completato' THEN
    v_service_key := current_setting('app.settings.service_role_key', true);

    IF v_service_key IS NOT NULL AND v_service_key <> '' THEN
      BEGIN
        PERFORM net.http_post(
          url := 'https://dmwyqyqaseyuybqfawvk.supabase.co/functions/v1/project-completed-webhook',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || v_service_key
          ),
          body := jsonb_build_object('project_id', NEW.id::text)
        );
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Error calling project-completed-webhook: %', SQLERRM;
      END;
    ELSE
      RAISE WARNING 'Skipping project-completed-webhook: service_role_key not configured';
    END IF;
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error in notify_project_completed_webhook: %', SQLERRM;
    RETURN NEW;
END;
$function$;