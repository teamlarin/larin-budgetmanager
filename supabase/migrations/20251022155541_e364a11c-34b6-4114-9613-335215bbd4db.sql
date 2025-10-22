-- Add admin role to the main administrator account
INSERT INTO public.user_roles (user_id, role)
VALUES ('841757e4-c05b-40e9-8346-a6bfc982c0b8', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;