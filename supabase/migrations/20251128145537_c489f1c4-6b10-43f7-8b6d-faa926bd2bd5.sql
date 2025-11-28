-- Update the notify_activity_assignment function to check if assignee_id is a valid user
CREATE OR REPLACE FUNCTION notify_activity_assignment()
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
  user_exists BOOLEAN;
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
      -- Check if the added_id is a valid user UUID that exists in profiles
      BEGIN
        SELECT EXISTS(
          SELECT 1 FROM profiles WHERE id = added_id::UUID
        ) INTO user_exists;
      EXCEPTION WHEN OTHERS THEN
        -- If conversion to UUID fails or any other error, skip this ID
        user_exists := false;
      END;
      
      -- Only insert notification if user exists
      IF user_exists THEN
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
    END IF;
  END LOOP;
  
  RETURN NEW;
END;
$$;