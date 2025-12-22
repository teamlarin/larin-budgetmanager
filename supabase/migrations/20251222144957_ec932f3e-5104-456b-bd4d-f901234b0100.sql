-- Add RLS policies for app_settings table
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Allow all approved users to view app settings
CREATE POLICY "Approved users can view app settings"
ON public.app_settings
FOR SELECT
USING (is_approved_user(auth.uid()));

-- Allow admins to insert app settings
CREATE POLICY "Admins can insert app settings"
ON public.app_settings
FOR INSERT
WITH CHECK (is_admin(auth.uid()));

-- Allow admins to update app settings
CREATE POLICY "Admins can update app settings"
ON public.app_settings
FOR UPDATE
USING (is_admin(auth.uid()));

-- Allow admins to delete app settings
CREATE POLICY "Admins can delete app settings"
ON public.app_settings
FOR DELETE
USING (is_admin(auth.uid()));