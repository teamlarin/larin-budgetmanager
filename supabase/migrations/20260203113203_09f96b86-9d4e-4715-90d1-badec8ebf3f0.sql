-- Update coordinator permissions to access settings sections
UPDATE public.role_permissions
SET 
  can_manage_clients = true,
  can_manage_products = true,
  can_manage_services = true,
  can_manage_templates = true,
  updated_at = now()
WHERE role = 'coordinator';