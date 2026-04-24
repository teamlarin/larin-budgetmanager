
-- Restrict who can insert progress updates: only admin, team_leader, or project leader of that project
DROP POLICY IF EXISTS "Authenticated users can insert progress updates" ON public.project_progress_updates;

CREATE POLICY "Only leaders, admins, team leaders insert progress updates"
ON public.project_progress_updates
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'team_leader')
    OR EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id
        AND p.project_leader_id = auth.uid()
    )
  )
);

-- Helper for UI to check authorization without extra round-trips/RLS subtleties
CREATE OR REPLACE FUNCTION public.can_update_project_progress(_project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'team_leader')
    OR EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = _project_id
        AND p.project_leader_id = auth.uid()
    );
$$;

GRANT EXECUTE ON FUNCTION public.can_update_project_progress(uuid) TO authenticated;
