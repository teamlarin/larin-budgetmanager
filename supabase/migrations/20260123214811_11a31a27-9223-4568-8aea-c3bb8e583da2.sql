-- Enable coordinator to create budgets/projects
UPDATE role_permissions 
SET can_create_projects = true 
WHERE role = 'coordinator';