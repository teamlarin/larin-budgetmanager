
CREATE OR REPLACE FUNCTION public.delete_user_completely(_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Delete from auth.mfa_amr_claims first (depends on sessions)
  DELETE FROM auth.mfa_amr_claims WHERE session_id IN (
    SELECT id FROM auth.sessions WHERE user_id = _user_id
  );

  -- Delete from auth.sessions
  DELETE FROM auth.sessions WHERE user_id = _user_id;
  
  -- Delete from auth.refresh_tokens - user_id is varchar here!
  DELETE FROM auth.refresh_tokens WHERE user_id = _user_id::text;
  
  -- Delete from auth.mfa_factors
  DELETE FROM auth.mfa_factors WHERE user_id = _user_id;

  -- Delete from auth.identities
  DELETE FROM auth.identities WHERE user_id = _user_id;

  -- Delete public data referencing user
  DELETE FROM public.activity_time_tracking WHERE user_id = _user_id;
  DELETE FROM public.notifications WHERE user_id = _user_id;
  DELETE FROM public.notification_preferences WHERE user_id = _user_id;
  DELETE FROM public.project_members WHERE user_id = _user_id;
  DELETE FROM public.project_audit_log WHERE user_id = _user_id;
  DELETE FROM public.project_additional_costs WHERE user_id = _user_id;
  DELETE FROM public.project_progress_updates WHERE user_id = _user_id;
  DELETE FROM public.budget_audit_log WHERE user_id = _user_id;
  DELETE FROM public.budget_items_audit_log WHERE user_id = _user_id;
  DELETE FROM public.user_action_logs WHERE user_id = _user_id;

  -- Delete budget_items for user's budgets and projects
  DELETE FROM public.budget_items WHERE budget_id IN (
    SELECT id FROM public.budgets WHERE user_id = _user_id
  );
  DELETE FROM public.budget_items WHERE project_id IN (
    SELECT id FROM public.projects WHERE user_id = _user_id
  );

  -- Delete budget_services for user's budgets
  DELETE FROM public.budget_services WHERE budget_id IN (
    SELECT id FROM public.budgets WHERE user_id = _user_id
  );

  -- Delete quote_payment_splits for user's quotes
  DELETE FROM public.quote_payment_splits WHERE quote_id IN (
    SELECT id FROM public.quotes WHERE user_id = _user_id
  );

  -- Delete project_services for user's projects
  DELETE FROM public.project_services WHERE project_id IN (
    SELECT id FROM public.projects WHERE user_id = _user_id
  );

  -- Update references in other users' data
  UPDATE public.projects SET account_user_id = NULL WHERE account_user_id = _user_id;
  UPDATE public.projects SET project_leader_id = NULL WHERE project_leader_id = _user_id;
  UPDATE public.clients SET account_user_id = NULL WHERE account_user_id = _user_id;

  -- Delete user-owned records
  DELETE FROM public.quotes WHERE user_id = _user_id;
  DELETE FROM public.budgets WHERE user_id = _user_id;
  DELETE FROM public.projects WHERE user_id = _user_id;
  DELETE FROM public.activity_categories WHERE user_id = _user_id;
  DELETE FROM public.levels WHERE user_id = _user_id;
  DELETE FROM public.products WHERE user_id = _user_id;
  DELETE FROM public.services WHERE user_id = _user_id;
  DELETE FROM public.budget_templates WHERE user_id = _user_id;
  DELETE FROM public.user_google_tokens WHERE user_id = _user_id;
  DELETE FROM public.clients WHERE user_id = _user_id;

  -- Delete user_roles
  DELETE FROM public.user_roles WHERE user_id = _user_id;
  
  -- Delete profile
  DELETE FROM public.profiles WHERE id = _user_id;
  
  -- Finally delete from auth.users
  DELETE FROM auth.users WHERE id = _user_id;
END;
$function$;
