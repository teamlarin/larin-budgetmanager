-- Add missing foreign key constraints with CASCADE/SET NULL for user deletion

-- activity_categories - CASCADE (user-owned data)
ALTER TABLE public.activity_categories
DROP CONSTRAINT IF EXISTS activity_categories_user_id_fkey;

ALTER TABLE public.activity_categories
ADD CONSTRAINT activity_categories_user_id_fkey 
FOREIGN KEY (user_id) 
REFERENCES auth.users(id) 
ON DELETE CASCADE;

-- activity_time_tracking - CASCADE (user-owned data)
ALTER TABLE public.activity_time_tracking
DROP CONSTRAINT IF EXISTS activity_time_tracking_user_id_fkey;

ALTER TABLE public.activity_time_tracking
ADD CONSTRAINT activity_time_tracking_user_id_fkey 
FOREIGN KEY (user_id) 
REFERENCES auth.users(id) 
ON DELETE CASCADE;

-- levels - CASCADE (user-owned data)
ALTER TABLE public.levels
DROP CONSTRAINT IF EXISTS levels_user_id_fkey;

ALTER TABLE public.levels
ADD CONSTRAINT levels_user_id_fkey 
FOREIGN KEY (user_id) 
REFERENCES auth.users(id) 
ON DELETE CASCADE;

-- products - CASCADE (user-owned data)
ALTER TABLE public.products
DROP CONSTRAINT IF EXISTS products_user_id_fkey;

ALTER TABLE public.products
ADD CONSTRAINT products_user_id_fkey 
FOREIGN KEY (user_id) 
REFERENCES auth.users(id) 
ON DELETE CASCADE;

-- services - CASCADE (user-owned data)
ALTER TABLE public.services
DROP CONSTRAINT IF EXISTS services_user_id_fkey;

ALTER TABLE public.services
ADD CONSTRAINT services_user_id_fkey 
FOREIGN KEY (user_id) 
REFERENCES auth.users(id) 
ON DELETE CASCADE;

-- quotes - CASCADE (user-owned data)
ALTER TABLE public.quotes
DROP CONSTRAINT IF EXISTS quotes_user_id_fkey;

ALTER TABLE public.quotes
ADD CONSTRAINT quotes_user_id_fkey 
FOREIGN KEY (user_id) 
REFERENCES auth.users(id) 
ON DELETE CASCADE;

-- projects.account_user_id - SET NULL (to preserve project data)
ALTER TABLE public.projects
DROP CONSTRAINT IF EXISTS projects_account_user_id_fkey;

ALTER TABLE public.projects
ADD CONSTRAINT projects_account_user_id_fkey 
FOREIGN KEY (account_user_id) 
REFERENCES auth.users(id) 
ON DELETE SET NULL;