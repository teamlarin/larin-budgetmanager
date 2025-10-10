-- Allow users to view all projects (not just their own)
DROP POLICY IF EXISTS "Users can view their own projects" ON public.projects;

CREATE POLICY "Approved users can view all projects"
  ON public.projects
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.approved = true
    )
  );

-- Keep other policies restrictive (users can only modify their own projects)
-- INSERT, UPDATE, DELETE policies remain unchanged