-- 1. Fix profiles self-approval: add WITH CHECK preventing users from changing their own 'approved' field
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND (
      -- Either the user is an admin (can change approved)
      public.has_role(auth.uid(), 'admin')
      -- Or the approved value is not being changed
      OR approved IS NOT DISTINCT FROM (SELECT p.approved FROM public.profiles p WHERE p.id = auth.uid())
    )
  );

-- 2. Fix notifications: restrict INSERT to authenticated users with user_id = auth.uid()
-- Note: SECURITY DEFINER triggers bypass RLS, so this won't break trigger-based inserts
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;
CREATE POLICY "Authenticated users can insert own notifications"
  ON public.notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 3. Fix audit log injection: restrict INSERT to authenticated users with user_id = auth.uid()
-- Note: SECURITY DEFINER triggers bypass RLS, so this won't break trigger-based inserts
DROP POLICY IF EXISTS "Anyone can insert audit logs" ON public.project_audit_log;
DROP POLICY IF EXISTS "System can insert audit logs" ON public.project_audit_log;
DROP POLICY IF EXISTS "Approved users can insert audit logs" ON public.project_audit_log;
CREATE POLICY "Authenticated users can insert own audit logs"
  ON public.project_audit_log
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Anyone can insert budget audit logs" ON public.budget_audit_log;
DROP POLICY IF EXISTS "System can insert budget audit logs" ON public.budget_audit_log;
DROP POLICY IF EXISTS "Approved users can insert budget audit logs" ON public.budget_audit_log;
CREATE POLICY "Authenticated users can insert own budget audit logs"
  ON public.budget_audit_log
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Anyone can insert budget items audit logs" ON public.budget_items_audit_log;
DROP POLICY IF EXISTS "System can insert budget items audit logs" ON public.budget_items_audit_log;
DROP POLICY IF EXISTS "Approved users can insert budget items audit logs" ON public.budget_items_audit_log;
CREATE POLICY "Authenticated users can insert own budget items audit logs"
  ON public.budget_items_audit_log
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);