
-- Drop the current overly permissive SELECT policy
DROP POLICY IF EXISTS "Only approved users can view projects" ON public.projects;
DROP POLICY IF EXISTS "Approved users can view all projects" ON public.projects;

-- Create a new SELECT policy: non-member roles see all, members see only their projects
CREATE POLICY "Role-based project visibility"
ON public.projects
FOR SELECT
TO authenticated
USING (
  -- Non-member approved roles can see all projects
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('admin', 'finance', 'team_leader', 'coordinator', 'account')
  )
  OR
  -- Members can only see projects they are assigned to or lead
  (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'member'
    )
    AND (
      -- Project leader
      projects.project_leader_id = auth.uid()
      OR
      -- Team member
      EXISTS (
        SELECT 1 FROM project_members
        WHERE project_members.project_id = projects.id
        AND project_members.user_id = auth.uid()
      )
    )
  )
  OR
  -- Users without a role but approved can see their own projects (fallback)
  (
    is_approved_user(auth.uid())
    AND NOT EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
    )
    AND projects.user_id = auth.uid()
  )
);
