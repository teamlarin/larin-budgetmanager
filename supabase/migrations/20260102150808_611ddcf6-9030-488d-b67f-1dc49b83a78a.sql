-- Add policy to allow approved users to view all time tracking for calculating project costs
CREATE POLICY "Approved users can view all time tracking for projects"
ON public.activity_time_tracking
FOR SELECT
USING (
  is_approved_user(auth.uid())
);