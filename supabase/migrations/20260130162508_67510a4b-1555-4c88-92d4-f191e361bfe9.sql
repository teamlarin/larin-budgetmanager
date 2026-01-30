-- Add missing UPDATE policies for user_activity_completions table
-- Required for upsert operations to work correctly

-- Users can update their own completions
CREATE POLICY "Users can update their own completions"
ON public.user_activity_completions
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Team leaders and admins can update completions for any user
CREATE POLICY "Team leaders can update completions for any user"
ON public.user_activity_completions
FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM user_roles
  WHERE user_roles.user_id = auth.uid()
  AND user_roles.role = ANY (ARRAY['admin'::app_role, 'team_leader'::app_role])
))
WITH CHECK (EXISTS (
  SELECT 1 FROM user_roles
  WHERE user_roles.user_id = auth.uid()
  AND user_roles.role = ANY (ARRAY['admin'::app_role, 'team_leader'::app_role])
));