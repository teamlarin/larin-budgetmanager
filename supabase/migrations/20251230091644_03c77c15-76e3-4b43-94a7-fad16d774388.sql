-- Add deleted_at column to profiles for soft delete
ALTER TABLE public.profiles ADD COLUMN deleted_at timestamp with time zone DEFAULT NULL;

-- Create index for faster queries on non-deleted users
CREATE INDEX idx_profiles_deleted_at ON public.profiles(deleted_at) WHERE deleted_at IS NULL;

-- Create function for soft delete
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
  
  -- Remove from active project assignments (optional - keep history)
  UPDATE public.projects SET account_user_id = NULL WHERE account_user_id = _user_id::text;
END;
$function$;

-- Create function to restore a soft-deleted user
CREATE OR REPLACE FUNCTION public.restore_user(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.profiles 
  SET deleted_at = NULL
  WHERE id = _user_id;
END;
$function$;

-- Update RLS policies to exclude soft-deleted users from normal views
DROP POLICY IF EXISTS "Approved users can view all profiles" ON public.profiles;
CREATE POLICY "Approved users can view active profiles" 
ON public.profiles 
FOR SELECT 
USING (is_approved_user(auth.uid()) AND deleted_at IS NULL);

DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = id);

-- Admins can view all profiles including deleted ones
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles including deleted" 
ON public.profiles 
FOR SELECT 
USING (is_admin(auth.uid()));