-- Add INSERT policy for coordinators on activity_time_tracking
CREATE POLICY "Coordinators can insert time tracking for any user"
ON public.activity_time_tracking
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM user_roles
    WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'coordinator'::app_role
  )
);

-- Add UPDATE policy for coordinators on activity_time_tracking
CREATE POLICY "Coordinators can update all time tracking"
ON public.activity_time_tracking
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM user_roles
    WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'coordinator'::app_role
  )
);

-- Add DELETE policy for coordinators on activity_time_tracking
CREATE POLICY "Coordinators can delete all time tracking"
ON public.activity_time_tracking
FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM user_roles
    WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'coordinator'::app_role
  )
);

-- Add INSERT policy for project leaders (users who are the project_leader_id of the project)
CREATE POLICY "Project leaders can insert time tracking for their projects"
ON public.activity_time_tracking
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM budget_items bi
    JOIN projects p ON p.id = bi.project_id
    WHERE bi.id = budget_item_id
      AND p.project_leader_id = auth.uid()
  )
);

-- Add UPDATE policy for project leaders
CREATE POLICY "Project leaders can update time tracking for their projects"
ON public.activity_time_tracking
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM budget_items bi
    JOIN projects p ON p.id = bi.project_id
    WHERE bi.id = budget_item_id
      AND p.project_leader_id = auth.uid()
  )
);

-- Add DELETE policy for project leaders
CREATE POLICY "Project leaders can delete time tracking for their projects"
ON public.activity_time_tracking
FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM budget_items bi
    JOIN projects p ON p.id = bi.project_id
    WHERE bi.id = budget_item_id
      AND p.project_leader_id = auth.uid()
  )
);