-- Fix log_project_change function to handle cases where auth.uid() is null
-- (e.g., when called from a SECURITY DEFINER function like soft_delete_user)
CREATE OR REPLACE FUNCTION public.log_project_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _user_id uuid;
BEGIN
  -- Get current user ID, skip logging if not available (system operation)
  _user_id := auth.uid();
  
  -- If no user is authenticated, skip audit logging
  -- This handles cases like soft_delete_user which runs as SECURITY DEFINER
  IF _user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Log name changes
  IF OLD.name IS DISTINCT FROM NEW.name THEN
    INSERT INTO public.project_audit_log (project_id, user_id, action, field_name, old_value, new_value)
    VALUES (NEW.id, _user_id, 'update', 'name', OLD.name, NEW.name);
  END IF;

  -- Log description changes
  IF OLD.description IS DISTINCT FROM NEW.description THEN
    INSERT INTO public.project_audit_log (project_id, user_id, action, field_name, old_value, new_value)
    VALUES (NEW.id, _user_id, 'update', 'description', OLD.description, NEW.description);
  END IF;

  -- Log objective changes
  IF OLD.objective IS DISTINCT FROM NEW.objective THEN
    INSERT INTO public.project_audit_log (project_id, user_id, action, field_name, old_value, new_value)
    VALUES (NEW.id, _user_id, 'update', 'objective', OLD.objective, NEW.objective);
  END IF;

  -- Log client changes
  IF OLD.client_id IS DISTINCT FROM NEW.client_id THEN
    INSERT INTO public.project_audit_log (project_id, user_id, action, field_name, old_value, new_value)
    VALUES (NEW.id, _user_id, 'update', 'client_id', OLD.client_id::TEXT, NEW.client_id::TEXT);
  END IF;

  -- Log account changes
  IF OLD.account_user_id IS DISTINCT FROM NEW.account_user_id THEN
    INSERT INTO public.project_audit_log (project_id, user_id, action, field_name, old_value, new_value)
    VALUES (NEW.id, _user_id, 'update', 'account_user_id', OLD.account_user_id::TEXT, NEW.account_user_id::TEXT);
  END IF;

  -- Log status changes
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.project_audit_log (project_id, user_id, action, field_name, old_value, new_value)
    VALUES (NEW.id, _user_id, 'update', 'status', OLD.status::TEXT, NEW.status::TEXT);
  END IF;

  -- Log discount changes
  IF OLD.discount_percentage IS DISTINCT FROM NEW.discount_percentage THEN
    INSERT INTO public.project_audit_log (project_id, user_id, action, field_name, old_value, new_value)
    VALUES (NEW.id, _user_id, 'update', 'discount_percentage', OLD.discount_percentage::TEXT, NEW.discount_percentage::TEXT);
  END IF;

  -- Log margin changes
  IF OLD.margin_percentage IS DISTINCT FROM NEW.margin_percentage THEN
    INSERT INTO public.project_audit_log (project_id, user_id, action, field_name, old_value, new_value)
    VALUES (NEW.id, _user_id, 'update', 'margin_percentage', OLD.margin_percentage::TEXT, NEW.margin_percentage::TEXT);
  END IF;

  -- Log project type changes
  IF OLD.project_type IS DISTINCT FROM NEW.project_type THEN
    INSERT INTO public.project_audit_log (project_id, user_id, action, field_name, old_value, new_value)
    VALUES (NEW.id, _user_id, 'update', 'project_type', OLD.project_type, NEW.project_type);
  END IF;

  -- Log brief link changes
  IF OLD.brief_link IS DISTINCT FROM NEW.brief_link THEN
    INSERT INTO public.project_audit_log (project_id, user_id, action, field_name, old_value, new_value)
    VALUES (NEW.id, _user_id, 'update', 'brief_link', OLD.brief_link, NEW.brief_link);
  END IF;

  RETURN NEW;
END;
$function$;