-- Update team_leader permissions to match account role for Settings access
UPDATE role_permissions 
SET 
  can_access_settings = true,
  can_manage_clients = true,
  can_manage_products = true,
  can_manage_services = true,
  can_manage_levels = true,
  can_manage_templates = true
WHERE role = 'team_leader';