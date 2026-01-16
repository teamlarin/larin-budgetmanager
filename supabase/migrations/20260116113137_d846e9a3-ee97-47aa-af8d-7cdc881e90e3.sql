-- Enable "can_create_projects" permission for account role
UPDATE public.role_permissions 
SET can_create_projects = true, updated_at = now()
WHERE role = 'account';