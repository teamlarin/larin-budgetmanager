DROP POLICY IF EXISTS "task assignees manageable by project task viewers" ON public.project_task_assignees;
CREATE POLICY "task assignees manageable by project task viewers"
  ON public.project_task_assignees FOR ALL TO authenticated
  USING (public.can_access_project_tasks((SELECT project_id FROM public.project_tasks t WHERE t.id = task_id)))
  WITH CHECK (
    public.can_access_project_tasks((SELECT project_id FROM public.project_tasks t WHERE t.id = task_id))
    AND (
      NOT public.has_role(auth.uid(), 'external')
      OR user_id = auth.uid()
      OR EXISTS (SELECT 1 FROM public.external_visible_users evu WHERE evu.external_user_id = auth.uid() AND evu.visible_user_id = project_task_assignees.user_id)
    )
  );