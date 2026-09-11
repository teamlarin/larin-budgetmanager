CREATE TABLE public.sales_revenue_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year integer NOT NULL,
  month integer NOT NULL,
  amount numeric(14,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sales_revenue_targets_year_month_key UNIQUE (year, month),
  CONSTRAINT sales_revenue_targets_month_valid CHECK (month BETWEEN 1 AND 12),
  CONSTRAINT sales_revenue_targets_amount_valid CHECK (amount >= 0)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales_revenue_targets TO authenticated;
GRANT ALL ON public.sales_revenue_targets TO service_role;

ALTER TABLE public.sales_revenue_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Finance roles can read sales revenue targets"
ON public.sales_revenue_targets FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'finance'::public.app_role)
  OR public.has_role(auth.uid(), 'account'::public.app_role)
);

CREATE POLICY "Admins and finance can insert sales revenue targets"
ON public.sales_revenue_targets FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'finance'::public.app_role)
);

CREATE POLICY "Admins and finance can update sales revenue targets"
ON public.sales_revenue_targets FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'finance'::public.app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'finance'::public.app_role)
);

CREATE POLICY "Admins and finance can delete sales revenue targets"
ON public.sales_revenue_targets FOR DELETE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'finance'::public.app_role)
);

CREATE TRIGGER update_sales_revenue_targets_updated_at
BEFORE UPDATE ON public.sales_revenue_targets
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.get_sales_revenue_monthly(p_year integer)
RETURNS TABLE (
  month integer,
  actual numeric,
  forecast numeric,
  collected numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'finance'::public.app_role)
    OR public.has_role(auth.uid(), 'account'::public.app_role)
  ) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  RETURN QUERY
  WITH months AS (
    SELECT generate_series(1, 12)::integer AS month
  ), invoice_months AS (
    SELECT
      EXTRACT(MONTH FROM COALESCE(iq.issued_at, iq.due_date::timestamptz, iq.created_at))::integer AS month,
      COALESCE(SUM(iq.amount) FILTER (WHERE iq.status IN ('emessa', 'incassata')), 0)::numeric AS actual,
      COALESCE(SUM(iq.amount) FILTER (WHERE iq.status <> 'annullata'), 0)::numeric AS forecast,
      COALESCE(SUM(iq.amount) FILTER (WHERE iq.status = 'incassata'), 0)::numeric AS collected
    FROM public.invoice_queue iq
    WHERE EXTRACT(YEAR FROM COALESCE(iq.issued_at, iq.due_date::timestamptz, iq.created_at))::integer = p_year
    GROUP BY 1
  )
  SELECT m.month,
         COALESCE(im.actual, 0)::numeric,
         COALESCE(im.forecast, 0)::numeric,
         COALESCE(im.collected, 0)::numeric
  FROM months m
  LEFT JOIN invoice_months im USING (month)
  ORDER BY m.month;
END;
$$;

REVOKE ALL ON FUNCTION public.get_sales_revenue_monthly(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_sales_revenue_monthly(integer) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_sales_mrr_by_client()
RETURNS TABLE (
  client_id uuid,
  client_name text,
  mrr numeric,
  active_subscriptions bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'finance'::public.app_role)
    OR public.has_role(auth.uid(), 'account'::public.app_role)
  ) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  RETURN QUERY
  WITH current_amount AS (
    SELECT DISTINCT ON (sa.subscription_id)
      sa.subscription_id,
      sa.amount
    FROM public.subscription_amounts sa
    WHERE sa.valid_from <= CURRENT_DATE
      AND (sa.valid_to IS NULL OR sa.valid_to > CURRENT_DATE)
    ORDER BY sa.subscription_id, sa.valid_from DESC
  )
  SELECT s.client_id,
         c.name,
         COALESCE(SUM(CASE s.periodicity
           WHEN 'mensile'::public.subscription_periodicity THEN ca.amount
           WHEN 'trimestrale'::public.subscription_periodicity THEN ca.amount / 3
           WHEN 'annuale'::public.subscription_periodicity THEN ca.amount / 12
           ELSE 0 END), 0)::numeric(14,2) AS mrr,
         COUNT(*)::bigint AS active_subscriptions
  FROM public.subscriptions s
  JOIN public.clients c ON c.id = s.client_id
  JOIN current_amount ca ON ca.subscription_id = s.id
  WHERE s.status = 'attivo'::public.subscription_status
  GROUP BY s.client_id, c.name
  ORDER BY mrr DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_sales_mrr_by_client() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_sales_mrr_by_client() TO authenticated, service_role;