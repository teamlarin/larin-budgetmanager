-- Step 1: Drop functions that depend on app_role enum
DROP FUNCTION IF EXISTS public.has_role(uuid, app_role);

-- Step 2: Create new enum with updated roles
CREATE TYPE public.app_role_new AS ENUM ('admin', 'account', 'finance', 'team_leader', 'member');

-- Step 3: Add temporary column with new enum type
ALTER TABLE public.user_roles ADD COLUMN role_new app_role_new;

-- Step 4: Migrate existing data
UPDATE public.user_roles 
SET role_new = CASE 
  WHEN role::text = 'admin' THEN 'admin'::app_role_new
  WHEN role::text = 'editor' THEN 'account'::app_role_new
  WHEN role::text = 'subscriber' THEN 'member'::app_role_new
END;

-- Step 5: Drop old column and enum
ALTER TABLE public.user_roles DROP COLUMN role;
DROP TYPE public.app_role;

-- Step 6: Rename new type and column
ALTER TYPE public.app_role_new RENAME TO app_role;
ALTER TABLE public.user_roles RENAME COLUMN role_new TO role;

-- Step 7: Make role column NOT NULL
ALTER TABLE public.user_roles ALTER COLUMN role SET NOT NULL;

-- Step 8: Recreate has_role function with new enum
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$function$;

-- Step 9: Update is_editor_or_admin function to check for admin or account roles
CREATE OR REPLACE FUNCTION public.is_editor_or_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin', 'account')
  )
$function$;

-- Step 10: Update handle_new_user function to use new default role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Insert profile with approval pending
  INSERT INTO public.profiles (id, email, first_name, last_name, approved)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    false
  );
  
  -- Assign default member role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'member');
  
  RETURN NEW;
END;
$function$;