-- Create notification_preferences table
CREATE TABLE public.notification_preferences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL,
  email_enabled BOOLEAN NOT NULL DEFAULT true,
  in_app_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, notification_type)
);

-- Enable RLS
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own notification preferences"
  ON public.notification_preferences
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own notification preferences"
  ON public.notification_preferences
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own notification preferences"
  ON public.notification_preferences
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notification preferences"
  ON public.notification_preferences
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_notification_preferences_updated_at
  BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to get user email preference
CREATE OR REPLACE FUNCTION public.get_user_email_preference(p_user_id UUID, p_notification_type TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (SELECT email_enabled FROM notification_preferences 
     WHERE user_id = p_user_id AND notification_type = p_notification_type),
    true  -- Default to enabled if no preference set
  );
$$;

-- Update the notify_project_leader_assignment function to check preferences
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
  v_in_app_enabled BOOLEAN;
  v_email_enabled BOOLEAN;
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
    
    -- Check user preferences
    SELECT 
      COALESCE(in_app_enabled, true),
      COALESCE(email_enabled, true)
    INTO v_in_app_enabled, v_email_enabled
    FROM notification_preferences
    WHERE user_id = NEW.user_id AND notification_type = 'project_leader_assigned';
    
    -- Default to enabled if no preference exists
    v_in_app_enabled := COALESCE(v_in_app_enabled, true);
    v_email_enabled := COALESCE(v_email_enabled, true);
    
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
    
    -- Insert in-app notification if enabled
    IF v_in_app_enabled THEN
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
    END IF;
    
    -- Call edge function to send email notification if enabled
    IF v_email_enabled THEN
      BEGIN
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
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Error sending email notification: %', SQLERRM;
      END;
    END IF;
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the transaction
    RAISE WARNING 'Error in notify_project_leader_assignment: %', SQLERRM;
    RETURN NEW;
END;
$$;