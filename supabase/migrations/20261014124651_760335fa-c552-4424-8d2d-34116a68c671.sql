CREATE POLICY "External users can insert assignments on assigned projects"
ON public.activity_time_tracking FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'external')
  AND scheduled_date IS NULL
  AND EXISTS (SELECT 1 FROM public.budget_items bi JOIN public.external_project_access epa ON epa.project_id = bi.project_id
              WHERE bi.id = activity_time_tracking.budget_item_id AND epa.user_id = auth.uid())
  AND (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.external_visible_users evu
       WHERE evu.external_user_id = auth.uid() AND evu.visible_user_id = activity_time_tracking.user_id))
);

CREATE POLICY "External users can delete assignments on assigned projects"
ON public.activity_time_tracking FOR DELETE TO authenticated
USING (
  public.has_role(auth.uid(), 'external')
  AND scheduled_date IS NULL
  AND EXISTS (SELECT 1 FROM public.budget_items bi JOIN public.external_project_access epa ON epa.project_id = bi.project_id
              WHERE bi.id = activity_time_tracking.budget_item_id AND epa.user_id = auth.uid())
);