
-- ============================================================
-- A. Move trigger_notify_budget_status_change to budgets table
-- ============================================================
DROP TRIGGER IF EXISTS trigger_notify_budget_status_change ON public.projects;
DROP TRIGGER IF EXISTS trigger_notify_budget_status_change ON public.budgets;

CREATE TRIGGER trigger_notify_budget_status_change
AFTER UPDATE ON public.budgets
FOR EACH ROW
EXECUTE FUNCTION public.notify_budget_status_change();

-- ============================================================
-- B. Rewrite cron jobs 3,5,6,7,8,9 to read CRON_SECRET from Vault
-- ============================================================
SELECT cron.unschedule(3);
SELECT cron.unschedule(5);
SELECT cron.unschedule(6);
SELECT cron.unschedule(7);
SELECT cron.unschedule(8);
SELECT cron.unschedule(9);

SELECT cron.schedule(
  'send-monthly-timesheet-reminder',
  '0 9 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/send-monthly-timesheet-reminder',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET'),
      'Content-Type', 'application/json'
    ),
    body := concat('{"time": "', now(), '"}')::jsonb
  );
  $$
);

SELECT cron.schedule(
  'invoke-send-weekly-planning-reminder',
  '30 16 * * 4',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/send-weekly-planning-reminder',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET'),
      'Content-Type', 'application/json'
    ),
    body := concat('{"time": "', now(), '"}')::jsonb
  );
  $$
);

SELECT cron.schedule(
  'weekly-progress-reminder',
  '0 16 * * 4',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/send-progress-reminder',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET'),
      'Content-Type', 'application/json'
    ),
    body := concat('{"time": "', now(), '"}')::jsonb
  );
  $$
);

SELECT cron.schedule(
  'weekly-ai-summary',
  '0 9 * * 1',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/send-weekly-ai-summary',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET'),
      'Content-Type', 'application/json'
    ),
    body := concat('{"time": "', now(), '"}')::jsonb
  );
  $$
);

SELECT cron.schedule(
  'check-margin-alerts',
  '0 8 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/check-margin-alerts',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET'),
      'Content-Type', 'application/json'
    ),
    body := concat('{"time": "', now(), '"}')::jsonb
  );
  $$
);

SELECT cron.schedule(
  'check-project-deadlines',
  '30 8 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/check-project-deadlines',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET'),
      'Content-Type', 'application/json'
    ),
    body := concat('{"time": "', now(), '"}')::jsonb
  );
  $$
);

-- ============================================================
-- C. Rewrite trigger functions to read secrets from Vault
-- ============================================================
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

    IF v_email_enabled THEN
      SELECT decrypted_secret INTO v_supabase_url
      FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL';

      SELECT decrypted_secret INTO v_service_key
      FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY';

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
        RAISE WARNING 'Skipping email notification: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY vault secret not configured';
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

CREATE OR REPLACE FUNCTION public.notify_project_completed_webhook()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_supabase_url TEXT;
  v_service_key TEXT;
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'completato' THEN
    SELECT decrypted_secret INTO v_supabase_url
    FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL';

    SELECT decrypted_secret INTO v_service_key
    FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY';

    IF v_supabase_url IS NOT NULL AND v_supabase_url <> ''
       AND v_service_key IS NOT NULL AND v_service_key <> '' THEN
      BEGIN
        PERFORM net.http_post(
          url := v_supabase_url || '/functions/v1/project-completed-webhook',
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
      RAISE WARNING 'Skipping project-completed-webhook: vault secrets not configured';
    END IF;
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error in notify_project_completed_webhook: %', SQLERRM;
    RETURN NEW;
END;
$function$;
