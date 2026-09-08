GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_contract_periods TO authenticated;
GRANT ALL ON public.user_contract_periods TO service_role;

CREATE POLICY "Finance can insert contract periods"
ON public.user_contract_periods FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'finance'::app_role));

CREATE POLICY "Finance can update contract periods"
ON public.user_contract_periods FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'finance'::app_role));

CREATE POLICY "Finance can delete contract periods"
ON public.user_contract_periods FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'finance'::app_role));