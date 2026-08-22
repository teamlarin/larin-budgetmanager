CREATE POLICY "task_attachments_select" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'task-attachments' AND public.is_approved_user(auth.uid()));

CREATE POLICY "task_attachments_insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'task-attachments' AND public.is_approved_user(auth.uid()) AND owner = auth.uid());

CREATE POLICY "task_attachments_delete" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'task-attachments' AND (owner = auth.uid() OR public.has_role(auth.uid(), 'admin')));