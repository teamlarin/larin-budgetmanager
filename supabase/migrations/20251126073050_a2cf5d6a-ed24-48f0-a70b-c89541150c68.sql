-- Function to send notifications when users are assigned to activities
CREATE OR REPLACE FUNCTION public.notify_activity_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  old_ids TEXT[];
  new_ids TEXT[];
  added_id TEXT;
  activity_name TEXT;
  project_name TEXT;
  project_uuid UUID;
BEGIN
  -- Get activity and project info
  activity_name := NEW.activity_name;
  project_uuid := NEW.project_id;
  
  -- Get project name
  SELECT name INTO project_name
  FROM projects
  WHERE id = project_uuid;
  
  -- Parse old and new assignee IDs
  IF OLD.assignee_id IS NOT NULL AND OLD.assignee_id != '' THEN
    old_ids := string_to_array(OLD.assignee_id, ',');
  ELSE
    old_ids := ARRAY[]::TEXT[];
  END IF;
  
  IF NEW.assignee_id IS NOT NULL AND NEW.assignee_id != '' THEN
    new_ids := string_to_array(NEW.assignee_id, ',');
  ELSE
    new_ids := ARRAY[]::TEXT[];
  END IF;
  
  -- Find newly added assignees and send notifications
  FOREACH added_id IN ARRAY new_ids
  LOOP
    -- Check if this is a new assignment
    IF NOT (added_id = ANY(old_ids)) THEN
      -- Insert notification for the newly assigned user
      INSERT INTO public.notifications (
        user_id,
        type,
        title,
        message,
        project_id,
        read
      )
      VALUES (
        added_id::UUID,
        'activity_assignment',
        'Nuova attività assegnata',
        format('Sei stato assegnato all''attività "%s" nel progetto "%s"', activity_name, project_name),
        project_uuid,
        false
      );
    END IF;
  END LOOP;
  
  RETURN NEW;
END;
$$;

-- Create trigger on budget_items for assignment notifications
DROP TRIGGER IF EXISTS trigger_notify_activity_assignment ON public.budget_items;

CREATE TRIGGER trigger_notify_activity_assignment
  AFTER UPDATE OF assignee_id ON public.budget_items
  FOR EACH ROW
  WHEN (OLD.assignee_id IS DISTINCT FROM NEW.assignee_id)
  EXECUTE FUNCTION public.notify_activity_assignment();