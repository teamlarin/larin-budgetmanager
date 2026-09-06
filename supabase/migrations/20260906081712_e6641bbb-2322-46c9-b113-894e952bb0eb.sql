CREATE POLICY "Finance and team leaders can view contract periods"
ON public.user_contract_periods
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'finance')
  OR public.has_role(auth.uid(), 'team_leader')
);