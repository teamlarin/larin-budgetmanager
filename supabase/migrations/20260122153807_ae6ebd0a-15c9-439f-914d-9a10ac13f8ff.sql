-- Create function to notify project leader assignment
CREATE OR REPLACE FUNCTION public.notify_project_leader_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_project_name TEXT;
  v_client_name TEXT;
  v_current_user_id UUID;
  v_new_leader_name TEXT;
BEGIN
  -- Get current user (who made the change)
  v_current_user_id := auth.uid();
  
  -- Only proceed if user_id (project leader) has changed and new value is not null
  IF (TG_OP = 'INSERT' AND NEW.user_id IS NOT NULL) OR 
     (TG_OP = 'UPDATE' AND OLD.user_id IS DISTINCT FROM NEW.user_id AND NEW.user_id IS NOT NULL) THEN
    
    -- Don't notify if the user is assigning themselves
    IF NEW.user_id = v_current_user_id THEN
      RETURN NEW;
    END IF;
    
    -- Get project name
    v_project_name := NEW.name;
    
    -- Get client name if available
    IF NEW.client_id IS NOT NULL THEN
      SELECT name INTO v_client_name
      FROM clients
      WHERE id = NEW.client_id;
    END IF;
    
    -- Get new leader name for notification message
    SELECT COALESCE(first_name || ' ' || last_name, first_name, email, 'Utente') 
    INTO v_new_leader_name
    FROM profiles
    WHERE id = NEW.user_id;
    
    -- Insert in-app notification
    INSERT INTO public.notifications (
      user_id,
      type,
      title,
      message,
      project_id,
      read
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
    
    -- Call edge function to send email notification
    -- Note: This is done via pg_net extension if available, otherwise the frontend handles it
    PERFORM net.http_post(
      url := current_setting('app.settings.supabase_url', true) || '/functions/v1/send-leader-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      ),
      body := jsonb_build_object(
        'user_id', NEW.user_id::text,
        'project_id', NEW.id::text,
        'project_name', v_project_name,
        'client_name', v_client_name
      )
    );
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the transaction
    RAISE WARNING 'Error in notify_project_leader_assignment: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- Create trigger for projects table
DROP TRIGGER IF EXISTS trigger_notify_project_leader_assignment ON projects;
CREATE TRIGGER trigger_notify_project_leader_assignment
  AFTER INSERT OR UPDATE OF user_id ON projects
  FOR EACH ROW
  EXECUTE FUNCTION notify_project_leader_assignment();

-- Create trigger for budgets table (when a budget is created with a project leader)
DROP TRIGGER IF EXISTS trigger_notify_budget_leader_assignment ON budgets;
CREATE TRIGGER trigger_notify_budget_leader_assignment
  AFTER INSERT OR UPDATE OF user_id ON budgets
  FOR EACH ROW
  EXECUTE FUNCTION notify_project_leader_assignment();