
-- Drop and recreate with public role to ensure it works for all authenticated users
DROP POLICY IF EXISTS "Approved users can view all time tracking" ON public.activity_time_tracking;

CREATE POLICY "Approved users can view all time tracking"
ON public.activity_time_tracking
FOR SELECT
TO public
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.approved = true
  )
);
