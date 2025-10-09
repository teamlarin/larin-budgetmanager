-- Add approval system and split name fields
ALTER TABLE public.profiles 
  ADD COLUMN approved boolean DEFAULT false,
  ADD COLUMN first_name text,
  ADD COLUMN last_name text;

-- Update existing profiles to split full_name into first_name and last_name
UPDATE public.profiles
SET 
  first_name = SPLIT_PART(full_name, ' ', 1),
  last_name = CASE 
    WHEN ARRAY_LENGTH(STRING_TO_ARRAY(full_name, ' '), 1) > 1 
    THEN SUBSTRING(full_name FROM POSITION(' ' IN full_name) + 1)
    ELSE ''
  END
WHERE full_name IS NOT NULL;

-- Update the handle_new_user function to use first_name and last_name
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
    false  -- New users need approval
  );
  
  -- Assign default subscriber role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'subscriber');
  
  RETURN NEW;
END;
$function$;

-- Create index for faster queries on approved status
CREATE INDEX idx_profiles_approved ON public.profiles(approved);

-- Update RLS policy to prevent unapproved users from accessing data
CREATE POLICY "Only approved users can access system"
  ON public.projects
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND approved = true
    )
  );

CREATE POLICY "Only approved users can access budget items"
  ON public.budget_items
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND approved = true
    )
  );

CREATE POLICY "Only approved users can access budget templates"
  ON public.budget_templates
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND approved = true
    )
  );

CREATE POLICY "Only approved users can access clients"
  ON public.clients
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND approved = true
    )
  );