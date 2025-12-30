-- Fix delete_user_completely function - projects.user_id and account_user_id are both UUID
CREATE OR REPLACE FUNCTION public.delete_user_completely(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Delete from auth.identities first (this is the blocker)
  DELETE FROM auth.identities WHERE user_id = _user_id;
  
  -- Delete from auth.sessions
  DELETE FROM auth.sessions WHERE user_id = _user_id;
  
  -- Delete from auth.refresh_tokens - user_id is varchar here!
  DELETE FROM auth.refresh_tokens WHERE user_id = _user_id::text;
  
  -- Delete from auth.mfa_factors
  DELETE FROM auth.mfa_factors WHERE user_id = _user_id;
  
  -- Delete from auth.mfa_amr_claims - get sessions first before deleting them
  DELETE FROM auth.mfa_amr_claims WHERE session_id IN (
    SELECT id FROM auth.sessions WHERE user_id = _user_id
  );
  
  -- Delete from public tables - cast uuid to text for text columns
  DELETE FROM public.activity_time_tracking WHERE user_id = _user_id::text;
  DELETE FROM public.notifications WHERE user_id = _user_id;
  DELETE FROM public.project_members WHERE user_id = _user_id;
  DELETE FROM public.project_audit_log WHERE user_id = _user_id::text;
  
  -- Delete budget_items for user's projects - projects.user_id is UUID
  DELETE FROM public.budget_items WHERE project_id IN (
    SELECT id FROM public.projects WHERE user_id = _user_id
  );
  
  -- Update projects to remove references - both are UUID
  UPDATE public.projects SET account_user_id = NULL WHERE account_user_id = _user_id;
  UPDATE public.projects SET user_id = NULL WHERE user_id = _user_id;
  
  -- Delete user-owned data - cast for text columns
  DELETE FROM public.quotes WHERE user_id = _user_id::text;
  DELETE FROM public.activity_categories WHERE user_id = _user_id::text;
  DELETE FROM public.levels WHERE user_id = _user_id::text;
  DELETE FROM public.products WHERE user_id = _user_id::text;
  DELETE FROM public.services WHERE user_id = _user_id::text;
  DELETE FROM public.budget_templates WHERE user_id = _user_id::text;
  
  -- Update clients to remove user_id
  UPDATE public.clients SET user_id = NULL WHERE user_id = _user_id::text;
  
  -- Delete user_roles
  DELETE FROM public.user_roles WHERE user_id = _user_id;
  
  -- Delete profile
  DELETE FROM public.profiles WHERE id = _user_id;
  
  -- Finally delete from auth.users
  DELETE FROM auth.users WHERE id = _user_id;
END;
$function$;