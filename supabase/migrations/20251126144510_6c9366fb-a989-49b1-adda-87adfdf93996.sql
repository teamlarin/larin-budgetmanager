-- Add foreign key constraints with CASCADE for user deletion

-- First, add foreign key on profiles table
ALTER TABLE public.profiles
DROP CONSTRAINT IF EXISTS profiles_id_fkey;

ALTER TABLE public.profiles
ADD CONSTRAINT profiles_id_fkey 
FOREIGN KEY (id) 
REFERENCES auth.users(id) 
ON DELETE CASCADE;

-- Add foreign key on user_roles table
ALTER TABLE public.user_roles
DROP CONSTRAINT IF EXISTS user_roles_user_id_fkey;

ALTER TABLE public.user_roles
ADD CONSTRAINT user_roles_user_id_fkey 
FOREIGN KEY (user_id) 
REFERENCES auth.users(id) 
ON DELETE CASCADE;

-- Update projects to SET NULL on user deletion (to preserve project data)
ALTER TABLE public.projects
DROP CONSTRAINT IF EXISTS projects_user_id_fkey;

ALTER TABLE public.projects
ADD CONSTRAINT projects_user_id_fkey 
FOREIGN KEY (user_id) 
REFERENCES auth.users(id) 
ON DELETE SET NULL;

-- Update clients to SET NULL on user deletion (to preserve client data)
ALTER TABLE public.clients
DROP CONSTRAINT IF EXISTS clients_user_id_fkey;

ALTER TABLE public.clients
ADD CONSTRAINT clients_user_id_fkey 
FOREIGN KEY (user_id) 
REFERENCES auth.users(id) 
ON DELETE SET NULL;

-- Add CASCADE on notifications
ALTER TABLE public.notifications
DROP CONSTRAINT IF EXISTS notifications_user_id_fkey;

ALTER TABLE public.notifications
ADD CONSTRAINT notifications_user_id_fkey 
FOREIGN KEY (user_id) 
REFERENCES auth.users(id) 
ON DELETE CASCADE;

-- Add CASCADE on project_members
ALTER TABLE public.project_members
DROP CONSTRAINT IF EXISTS project_members_user_id_fkey;

ALTER TABLE public.project_members
ADD CONSTRAINT project_members_user_id_fkey 
FOREIGN KEY (user_id) 
REFERENCES auth.users(id) 
ON DELETE CASCADE;