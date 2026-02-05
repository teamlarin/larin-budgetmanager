-- Create function to call the edge function when a project is completed
CREATE OR REPLACE FUNCTION public.notify_project_completed_webhook()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only trigger when status changes to 'completato'
  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'completato' THEN
    -- Call the edge function via pg_net
    PERFORM net.http_post(
      url := 'https://dmwyqyqaseyuybqfawvk.supabase.co/functions/v1/project-completed-webhook',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      ),
      body := jsonb_build_object('project_id', NEW.id::text)
    );
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the transaction
    RAISE WARNING 'Error calling project-completed-webhook: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- Create trigger on projects table
DROP TRIGGER IF EXISTS trigger_project_completed_webhook ON projects;
CREATE TRIGGER trigger_project_completed_webhook
  AFTER UPDATE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION notify_project_completed_webhook();