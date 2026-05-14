
DROP POLICY IF EXISTS "Approved users can view hour adjustments" ON public.user_hours_adjustments;

CREATE POLICY "Restricted view of hour adjustments"
  ON public.user_hours_adjustments FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'finance'::app_role)
    OR has_role(auth.uid(), 'coordinator'::app_role)
  );

DROP POLICY IF EXISTS "Approved users can view carryover" ON public.user_hours_carryover;

CREATE POLICY "Restricted view of carryover"
  ON public.user_hours_carryover FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'finance'::app_role)
  );
