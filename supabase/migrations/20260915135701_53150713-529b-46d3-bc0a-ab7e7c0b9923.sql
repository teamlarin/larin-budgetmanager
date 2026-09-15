CREATE TABLE public.hubspot_budget_exclusions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_name text NOT NULL,
  client_name text,
  excluded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX hubspot_budget_exclusions_deal_name_key
  ON public.hubspot_budget_exclusions (lower(btrim(deal_name)));

GRANT SELECT, INSERT, DELETE ON public.hubspot_budget_exclusions TO authenticated;
GRANT ALL ON public.hubspot_budget_exclusions TO service_role;

ALTER TABLE public.hubspot_budget_exclusions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Approved users can view hubspot exclusions"
ON public.hubspot_budget_exclusions
FOR SELECT
TO authenticated
USING (public.is_approved_user(auth.uid()));

CREATE POLICY "Admin and account can add hubspot exclusions"
ON public.hubspot_budget_exclusions
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'account'));

CREATE POLICY "Admin and account can remove hubspot exclusions"
ON public.hubspot_budget_exclusions
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'account'));

INSERT INTO public.hubspot_budget_exclusions (deal_name, client_name)
VALUES ('FasG&P - Nuovo sito web', NULL);