ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_subscriptions_project_id ON public.subscriptions(project_id) WHERE project_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.get_offer_version_split(_offer_version_id uuid)
RETURNS TABLE(one_off_total numeric, recurring_total numeric, offered_total numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH l AS (
    SELECT coalesce(sum(ol.line_total) FILTER (WHERE p.product_nature = 'ricorrente'),0) AS rec,
           coalesce(sum(ol.line_total),0) AS net
      FROM public.offer_lines ol
      LEFT JOIN public.products p ON p.id = ol.product_id
     WHERE ol.offer_version_id = _offer_version_id
  ), v AS (SELECT ov.offered_total FROM public.offer_versions ov WHERE ov.id = _offer_version_id)
  SELECT
    round(CASE WHEN l.net > 0 THEN v.offered_total * (l.net - l.rec) / l.net ELSE v.offered_total END, 2),
    round(CASE WHEN l.net > 0 THEN v.offered_total * l.rec / l.net ELSE 0 END, 2),
    v.offered_total
  FROM l, v
  WHERE public.is_approved_user(auth.uid()) OR auth.role() = 'service_role';
$$;
REVOKE ALL ON FUNCTION public.get_offer_version_split(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_offer_version_split(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.validate_offer_payment_terms_balance(_offer_version_id uuid)
RETURNS void LANGUAGE plpgsql STABLE SET search_path = public
AS $$
DECLARE
  v_billing_mode public.offer_billing_mode;
  v_offered_total numeric(12,2);
  v_target numeric;
  v_rec numeric; v_net numeric;
  v_count integer; v_sum numeric; v_tolerance numeric;
BEGIN
  SELECT billing_mode, offered_total INTO v_billing_mode, v_offered_total
    FROM public.offer_versions WHERE id = _offer_version_id;
  IF v_billing_mode IS DISTINCT FROM 'importo_finito' THEN RETURN; END IF;
  SELECT coalesce(sum(ol.line_total) FILTER (WHERE p.product_nature = 'ricorrente'),0), coalesce(sum(ol.line_total),0)
    INTO v_rec, v_net
    FROM public.offer_lines ol LEFT JOIN public.products p ON p.id = ol.product_id
   WHERE ol.offer_version_id = _offer_version_id;
  v_target := CASE WHEN v_net > 0 THEN round(v_offered_total * (v_net - v_rec) / v_net, 2) ELSE v_offered_total END;
  SELECT count(*), coalesce(sum(coalesce(amount, round(v_target * percentage / 100, 2))), 0)
    INTO v_count, v_sum
    FROM public.offer_payment_terms WHERE offer_version_id = _offer_version_id;
  IF v_count = 0 THEN RETURN; END IF;
  v_tolerance := round(v_target * (v_count * 0.01) / 100, 2);
  IF abs(v_sum - v_target) > v_tolerance THEN
    RAISE EXCEPTION 'Le tranche di pagamento (%) non quadrano con la quota a progetto (%): differenza % oltre la tolleranza di %',
      v_sum, v_target, abs(v_sum - v_target), v_tolerance;
  END IF;
END;
$$;