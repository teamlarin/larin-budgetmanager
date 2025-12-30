-- Add policy to allow admins to insert time tracking for any user
CREATE POLICY "Admins can insert time tracking for any user"
ON public.activity_time_tracking
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);

-- Add policy to allow admins to view all time tracking
CREATE POLICY "Admins can view all time tracking"
ON public.activity_time_tracking
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);

-- Add policy to allow admins to update all time tracking
CREATE POLICY "Admins can update all time tracking"
ON public.activity_time_tracking
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);

-- Add policy to allow admins to delete all time tracking
CREATE POLICY "Admins can delete all time tracking"
ON public.activity_time_tracking
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);