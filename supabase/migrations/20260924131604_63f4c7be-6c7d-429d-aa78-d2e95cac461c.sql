DROP POLICY IF EXISTS "roadblocks_select" ON public.project_roadblocks;
CREATE POLICY "roadblocks_select" ON public.project_roadblocks
  FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL AND public.can_access_project_tasks(project_id));

DROP POLICY IF EXISTS "roadblocks_update" ON public.project_roadblocks;
CREATE POLICY "roadblocks_update" ON public.project_roadblocks
  FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL AND public.can_update_project_progress(project_id))
  WITH CHECK (auth.uid() IS NOT NULL AND public.can_update_project_progress(project_id));

DROP POLICY IF EXISTS "roadblocks_delete" ON public.project_roadblocks;
CREATE POLICY "roadblocks_delete" ON public.project_roadblocks
  FOR DELETE TO authenticated
  USING (auth.uid() IS NOT NULL AND public.is_admin(auth.uid()));