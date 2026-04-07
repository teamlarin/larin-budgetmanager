
-- Drop the overly permissive policy
DROP POLICY "Authenticated users can manage adjustments" ON public.project_timesheet_adjustments;

-- SELECT: approved users can view adjustments
CREATE POLICY "Approved users can view adjustments"
ON public.project_timesheet_adjustments
FOR SELECT
TO authenticated
USING (is_approved_user(auth.uid()));

-- INSERT: admins, team_leaders, coordinators, accounts, or project leaders
CREATE POLICY "Authorized users can insert adjustments"
ON public.project_timesheet_adjustments
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin') OR
  has_role(auth.uid(), 'team_leader') OR
  has_role(auth.uid(), 'coordinator') OR
  has_role(auth.uid(), 'account') OR
  EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = project_timesheet_adjustments.project_id
    AND p.project_leader_id = auth.uid()
  )
);

-- UPDATE: same roles
CREATE POLICY "Authorized users can update adjustments"
ON public.project_timesheet_adjustments
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'admin') OR
  has_role(auth.uid(), 'team_leader') OR
  has_role(auth.uid(), 'coordinator') OR
  has_role(auth.uid(), 'account') OR
  EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = project_timesheet_adjustments.project_id
    AND p.project_leader_id = auth.uid()
  )
);

-- DELETE: same roles
CREATE POLICY "Authorized users can delete adjustments"
ON public.project_timesheet_adjustments
FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'admin') OR
  has_role(auth.uid(), 'team_leader') OR
  has_role(auth.uid(), 'coordinator') OR
  has_role(auth.uid(), 'account') OR
  EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = project_timesheet_adjustments.project_id
    AND p.project_leader_id = auth.uid()
  )
);
