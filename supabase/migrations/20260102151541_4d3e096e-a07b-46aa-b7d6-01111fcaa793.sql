-- Drop and recreate the policy to ensure it's active
DROP POLICY IF EXISTS "Approved users can view all time tracking for projects" ON public.activity_time_tracking;

-- Recreate with explicit configuration
CREATE POLICY "Approved users can view all time tracking"
ON public.activity_time_tracking
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.approved = true
  )
);