-- Add policy for admin, team_leader, and coordinator to view all user_activity_completions
CREATE POLICY "Admins and team leaders can view all completions"
ON public.user_activity_completions
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('admin', 'team_leader', 'coordinator')
  )
);