-- Fix soft_delete_user function to cast UUID to text for text columns
CREATE OR REPLACE FUNCTION public.soft_delete_user(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Mark the profile as deleted
  UPDATE public.profiles 
  SET deleted_at = now(), 
      approved = false
  WHERE id = _user_id;
  
  -- Deactivate user sessions
  DELETE FROM auth.sessions WHERE user_id = _user_id;
  DELETE FROM auth.refresh_tokens WHERE user_id = _user_id;
  
  -- Update projects to remove references - account_user_id is text, need to cast
  UPDATE public.projects SET account_user_id = NULL WHERE account_user_id = _user_id::text;
END;
$function$;