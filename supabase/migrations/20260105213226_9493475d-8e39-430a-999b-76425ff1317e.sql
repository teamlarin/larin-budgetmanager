-- Update policies to allow team_leader to manage time tracking for all users

-- Add policy for team_leader to insert time tracking for any user
CREATE POLICY "Team leaders can insert time tracking for any user"
ON public.activity_time_tracking
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'team_leader'
  )
);

-- Add policy for team_leader to update all time tracking
CREATE POLICY "Team leaders can update all time tracking"
ON public.activity_time_tracking
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'team_leader'
  )
);

-- Add policy for team_leader to delete all time tracking
CREATE POLICY "Team leaders can delete all time tracking"
ON public.activity_time_tracking
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'team_leader'
  )
);

-- Add policies for user_activity_completions for team_leader
CREATE POLICY "Team leaders can insert completions for any user"
ON public.user_activity_completions
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('admin', 'team_leader')
  )
);

CREATE POLICY "Team leaders can delete completions for any user"
ON public.user_activity_completions
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('admin', 'team_leader')
  )
);