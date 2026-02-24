
CREATE OR REPLACE FUNCTION public.delete_user_completely(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _admin_id uuid;
BEGIN
  -- Find an admin to transfer ownership to
  SELECT ur.user_id INTO _admin_id
  FROM public.user_roles ur
  JOIN public.profiles p ON p.id = ur.user_id
  WHERE ur.role = 'admin' AND p.deleted_at IS NULL AND ur.user_id != _user_id
  LIMIT 1;

  -- Delete from auth.mfa_amr_claims first (depends on sessions)
  DELETE FROM auth.mfa_amr_claims WHERE session_id IN (
    SELECT id FROM auth.sessions WHERE user_id = _user_id
  );

  -- Delete from auth.sessions
  DELETE FROM auth.sessions WHERE user_id = _user_id;
  
  -- Delete from auth.refresh_tokens
  DELETE FROM auth.refresh_tokens WHERE user_id = _user_id::text;
  
  -- Delete from auth.mfa_factors
  DELETE FROM auth.mfa_factors WHERE user_id = _user_id;

  -- Delete from auth.identities
  DELETE FROM auth.identities WHERE user_id = _user_id;

  -- Delete user-specific data (not transferable)
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

  -- Update references in other users' data
  UPDATE public.projects SET account_user_id = NULL WHERE account_user_id = _user_id;
  UPDATE public.projects SET project_leader_id = NULL WHERE project_leader_id = _user_id;
  UPDATE public.clients SET account_user_id = NULL WHERE account_user_id = _user_id;

  IF _admin_id IS NOT NULL THEN
    -- Transfer ownership of projects, budgets, quotes, clients, etc. to admin
    UPDATE public.projects SET user_id = _admin_id WHERE user_id = _user_id;
    UPDATE public.budgets SET user_id = _admin_id WHERE user_id = _user_id;
    UPDATE public.quotes SET user_id = _admin_id WHERE user_id = _user_id;
    UPDATE public.clients SET user_id = _admin_id WHERE user_id = _user_id;
    UPDATE public.activity_categories SET user_id = _admin_id WHERE user_id = _user_id;
    UPDATE public.levels SET user_id = _admin_id WHERE user_id = _user_id;
    UPDATE public.products SET user_id = _admin_id WHERE user_id = _user_id;
    UPDATE public.services SET user_id = _admin_id WHERE user_id = _user_id;
    UPDATE public.budget_templates SET user_id = _admin_id WHERE user_id = _user_id;
  ELSE
    -- No admin found, delete as fallback
    DELETE FROM public.budget_items WHERE budget_id IN (
      SELECT id FROM public.budgets WHERE user_id = _user_id
    );
    DELETE FROM public.budget_items WHERE project_id IN (
      SELECT id FROM public.projects WHERE user_id = _user_id
    );
    DELETE FROM public.budget_services WHERE budget_id IN (
      SELECT id FROM public.budgets WHERE user_id = _user_id
    );
    DELETE FROM public.quote_payment_splits WHERE quote_id IN (
      SELECT id FROM public.quotes WHERE user_id = _user_id
    );
    DELETE FROM public.project_services WHERE project_id IN (
      SELECT id FROM public.projects WHERE user_id = _user_id
    );
    DELETE FROM public.quotes WHERE user_id = _user_id;
    DELETE FROM public.budgets WHERE user_id = _user_id;
    DELETE FROM public.projects WHERE user_id = _user_id;
    DELETE FROM public.activity_categories WHERE user_id = _user_id;
    DELETE FROM public.levels WHERE user_id = _user_id;
    DELETE FROM public.products WHERE user_id = _user_id;
    DELETE FROM public.services WHERE user_id = _user_id;
    DELETE FROM public.budget_templates WHERE user_id = _user_id;
    DELETE FROM public.clients WHERE user_id = _user_id;
  END IF;

  -- Delete google tokens
  DELETE FROM public.user_google_tokens WHERE user_id = _user_id;

  -- Delete user_roles
  DELETE FROM public.user_roles WHERE user_id = _user_id;
  
  -- Delete profile
  DELETE FROM public.profiles WHERE id = _user_id;
  
  -- Finally delete from auth.users
  DELETE FROM auth.users WHERE id = _user_id;
END;
$$;
