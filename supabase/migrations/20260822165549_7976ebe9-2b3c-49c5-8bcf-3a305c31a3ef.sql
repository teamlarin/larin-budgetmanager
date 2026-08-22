CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA extensions;

CREATE TYPE public.subscription_periodicity AS ENUM ('mensile', 'trimestrale', 'annuale');
CREATE TYPE public.subscription_status AS ENUM ('attivo', 'disdettato', 'concluso');
CREATE TYPE public.subscription_period_status AS ENUM ('previsto', 'accodato', 'annullato');

CREATE TABLE public.subscriptions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  offer_id uuid REFERENCES public.offers(id) ON DELETE SET NULL,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  description text NOT NULL CHECK (btrim(description) <> ''),
  periodicity public.subscription_periodicity NOT NULL,
  start_date date NOT NULL,
  end_date date,
  auto_renew boolean NOT NULL DEFAULT true,
  notice_days integer CHECK (notice_days IS NULL OR notice_days >= 0),
  document_kind public.invoice_document_kind NOT NULL DEFAULT 'fattura',
  generate_days_before integer NOT NULL DEFAULT 15 CHECK (generate_days_before >= 0),
  status public.subscription_status NOT NULL DEFAULT 'attivo',
  cancelled_at timestamptz,
  cancelled_effective_date date,
  cancelled_reason text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT subscriptions_dates_check CHECK (end_date IS NULL OR end_date >= start_date),
  CONSTRAINT subscriptions_cancelled_shape_check CHECK (
    (status = 'disdettato') = (cancelled_at IS NOT NULL AND cancelled_effective_date IS NOT NULL)
  )
);

COMMENT ON TABLE public.subscriptions IS 'Abbonamenti e canoni ricorrenti. Hanno vita propria: il riferimento all''offerta di origine e facoltativo (AD-9).';
COMMENT ON COLUMN public.subscriptions.generate_days_before IS 'Quanti giorni prima dell''inizio del periodo la fattura prevista entra in coda (FR-27).';
COMMENT ON COLUMN public.subscriptions.cancelled_effective_date IS 'Data da cui la disdetta ha effetto: i periodi che iniziano dopo non si generano piu, quelli gia fatturati restano.';

CREATE INDEX idx_subscriptions_client_id ON public.subscriptions(client_id);
CREATE INDEX idx_subscriptions_offer_id ON public.subscriptions(offer_id) WHERE offer_id IS NOT NULL;
CREATE INDEX idx_subscriptions_status ON public.subscriptions(status);

CREATE TRIGGER update_subscriptions_updated_at
BEFORE UPDATE ON public.subscriptions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.subscription_amounts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  subscription_id uuid NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  vat_rate numeric NOT NULL DEFAULT 22,
  valid_from date NOT NULL,
  valid_to date,
  note text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT subscription_amounts_range_check CHECK (valid_to IS NULL OR valid_to > valid_from),
  CONSTRAINT subscription_amounts_no_overlap EXCLUDE USING gist (
    subscription_id WITH =,
    daterange(valid_from, valid_to, '[)') WITH &&
  )
);

COMMENT ON TABLE public.subscription_amounts IS 'Storia del canone di un abbonamento. Le variazioni sono righe nuove, non aggiornamenti (FR-29).';

CREATE INDEX idx_subscription_amounts_subscription_id ON public.subscription_amounts(subscription_id);

CREATE TABLE public.subscription_periods (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  subscription_id uuid NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  period_key text NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  vat_rate numeric NOT NULL DEFAULT 22,
  status public.subscription_period_status NOT NULL DEFAULT 'previsto',
  generated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT subscription_periods_range_check CHECK (period_end >= period_start)
);

COMMENT ON TABLE public.subscription_periods IS 'Periodi di un abbonamento, materializzati e non calcolati al volo.';
COMMENT ON COLUMN public.subscription_periods.period_key IS 'Chiave deterministica del periodo: 2026-03 mensile, 2026-Q2 trimestrale, 2026 annuale.';

CREATE UNIQUE INDEX idx_subscription_periods_unique ON public.subscription_periods(subscription_id, period_key);
CREATE INDEX idx_subscription_periods_status ON public.subscription_periods(status);
CREATE INDEX idx_subscription_periods_start ON public.subscription_periods(period_start);

ALTER TABLE public.invoice_queue
  ADD COLUMN IF NOT EXISTS subscription_period_id uuid REFERENCES public.subscription_periods(id) ON DELETE RESTRICT;

ALTER TABLE public.invoice_queue ALTER COLUMN offer_id DROP NOT NULL;
ALTER TABLE public.invoice_queue ALTER COLUMN offer_version_id DROP NOT NULL;
ALTER TABLE public.invoice_queue ALTER COLUMN offer_payment_term_id DROP NOT NULL;

ALTER TABLE public.invoice_queue
  ADD CONSTRAINT invoice_queue_single_origin_check CHECK (
    (offer_payment_term_id IS NOT NULL AND subscription_period_id IS NULL AND offer_id IS NOT NULL AND offer_version_id IS NOT NULL)
    OR
    (subscription_period_id IS NOT NULL AND offer_payment_term_id IS NULL)
  );

CREATE INDEX idx_invoice_queue_subscription_period ON public.invoice_queue(subscription_period_id) WHERE subscription_period_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.get_subscription_amount_at(_subscription_id uuid, _at date)
RETURNS public.subscription_amounts
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.subscription_amounts
   WHERE subscription_id = _subscription_id
     AND valid_from <= _at
     AND (valid_to IS NULL OR valid_to > _at)
   LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.get_subscription_amount_at(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_subscription_amount_at(uuid, date) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.subscription_period_key(_periodicity public.subscription_periodicity, _start date)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE _periodicity
    WHEN 'mensile' THEN to_char(_start, 'YYYY-MM')
    WHEN 'trimestrale' THEN to_char(_start, 'YYYY') || '-Q' || to_char(_start, 'Q')
    WHEN 'annuale' THEN to_char(_start, 'YYYY')
  END
$$;

REVOKE ALL ON FUNCTION public.subscription_period_key(public.subscription_periodicity, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.subscription_period_key(public.subscription_periodicity, date) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.generate_subscription_periods(
  _subscription_id uuid,
  _until date DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _s public.subscriptions;
  _step interval;
  _cursore date;
  _fine_periodo date;
  _limite date;
  _canone public.subscription_amounts;
  _creati integer := 0;
BEGIN
  SELECT * INTO _s FROM public.subscriptions WHERE id = _subscription_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Abbonamento % non trovato', _subscription_id;
  END IF;

  _step := CASE _s.periodicity
             WHEN 'mensile' THEN interval '1 month'
             WHEN 'trimestrale' THEN interval '3 months'
             WHEN 'annuale' THEN interval '1 year'
           END;

  _limite := COALESCE(_until, current_date + _s.generate_days_before);
  IF _s.end_date IS NOT NULL AND _s.end_date < _limite THEN
    _limite := _s.end_date;
  END IF;
  IF _s.cancelled_effective_date IS NOT NULL AND _s.cancelled_effective_date < _limite THEN
    _limite := _s.cancelled_effective_date;
  END IF;

  _cursore := _s.start_date;
  WHILE _cursore <= _limite LOOP
    _fine_periodo := (_cursore + _step - interval '1 day')::date;
    _canone := public.get_subscription_amount_at(_subscription_id, _cursore);

    IF _canone.id IS NULL THEN
      RAISE EXCEPTION 'Nessun canone valido al %: registrare l''importo prima di generare i periodi', _cursore;
    END IF;

    INSERT INTO public.subscription_periods (
      subscription_id, period_key, period_start, period_end, amount, vat_rate
    ) VALUES (
      _subscription_id,
      public.subscription_period_key(_s.periodicity, _cursore),
      _cursore, _fine_periodo, _canone.amount, _canone.vat_rate
    )
    ON CONFLICT (subscription_id, period_key) DO NOTHING;

    IF FOUND THEN
      _creati := _creati + 1;
    END IF;

    _cursore := (_cursore + _step)::date;
  END LOOP;

  RETURN _creati;
END;
$$;

COMMENT ON FUNCTION public.generate_subscription_periods(uuid, date) IS 'Crea i periodi mancanti di un abbonamento fino all''anticipo configurato. Ripetibile (FR-27).';

REVOKE ALL ON FUNCTION public.generate_subscription_periods(uuid, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_subscription_periods(uuid, date) TO service_role;

CREATE OR REPLACE FUNCTION public.enqueue_invoice_for_subscription_period(_subscription_period_id uuid)
RETURNS public.invoice_queue
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _p public.subscription_periods;
  _s public.subscriptions;
  _row public.invoice_queue;
  _chiave text;
BEGIN
  SELECT * INTO _p FROM public.subscription_periods WHERE id = _subscription_period_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Periodo % non trovato', _subscription_period_id;
  END IF;

  IF _p.status = 'annullato' THEN
    RAISE EXCEPTION 'Il periodo e annullato: non va fatturato'
      USING errcode = 'check_violation';
  END IF;

  SELECT * INTO _s FROM public.subscriptions WHERE id = _p.subscription_id;

  _chiave := 'subscription_period:' || _p.id::text;

  INSERT INTO public.invoice_queue (
    subscription_period_id, offer_id, client_id, document_kind,
    amount, vat_rate, description, due_date, idempotency_key
  ) VALUES (
    _p.id, _s.offer_id, _s.client_id, _s.document_kind,
    _p.amount, _p.vat_rate,
    format('%s, periodo %s', _s.description, _p.period_key),
    _p.period_start,
    _chiave
  )
  ON CONFLICT (idempotency_key) DO NOTHING
  RETURNING * INTO _row;

  IF _row.id IS NULL THEN
    SELECT * INTO _row FROM public.invoice_queue WHERE idempotency_key = _chiave;
  ELSE
    UPDATE public.subscription_periods SET status = 'accodato' WHERE id = _p.id;
  END IF;

  RETURN _row;
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_invoice_for_subscription_period(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_invoice_for_subscription_period(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.run_subscription_billing()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _s RECORD;
  _p RECORD;
  _periodi integer := 0;
  _accodate integer := 0;
  _errori jsonb := '[]'::jsonb;
BEGIN
  FOR _s IN SELECT id FROM public.subscriptions WHERE status = 'attivo' LOOP
    BEGIN
      _periodi := _periodi + public.generate_subscription_periods(_s.id);
    EXCEPTION WHEN OTHERS THEN
      _errori := _errori || jsonb_build_object('subscription_id', _s.id, 'errore', SQLERRM);
    END;
  END LOOP;

  FOR _p IN
    SELECT sp.id FROM public.subscription_periods sp
    JOIN public.subscriptions s ON s.id = sp.subscription_id
    WHERE sp.status = 'previsto'
      AND s.status = 'attivo'
      AND sp.period_start <= current_date + s.generate_days_before
  LOOP
    BEGIN
      PERFORM public.enqueue_invoice_for_subscription_period(_p.id);
      _accodate := _accodate + 1;
    EXCEPTION WHEN OTHERS THEN
      _errori := _errori || jsonb_build_object('subscription_period_id', _p.id, 'errore', SQLERRM);
    END;
  END LOOP;

  RETURN jsonb_build_object('periodi_creati', _periodi, 'fatture_accodate', _accodate, 'errori', _errori);
END;
$$;

COMMENT ON FUNCTION public.run_subscription_billing() IS 'Giro completo della fatturazione ricorrente: genera i periodi mancanti e accoda quelli entro l''anticipo.';

REVOKE ALL ON FUNCTION public.run_subscription_billing() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.run_subscription_billing() TO service_role;

CREATE OR REPLACE FUNCTION public.cancel_subscription(
  _subscription_id uuid,
  _effective_date date,
  _reason text DEFAULT NULL
)
RETURNS public.subscriptions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row public.subscriptions;
BEGIN
  IF NOT public.is_approved_user(auth.uid()) AND auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Non autorizzato a registrare una disdetta';
  END IF;

  UPDATE public.subscriptions
     SET status = 'disdettato',
         cancelled_at = now(),
         cancelled_effective_date = _effective_date,
         cancelled_reason = nullif(btrim(_reason), '')
   WHERE id = _subscription_id AND status = 'attivo'
  RETURNING * INTO _row;

  IF _row.id IS NULL THEN
    RAISE EXCEPTION 'Si disdice solo un abbonamento attivo';
  END IF;

  UPDATE public.subscription_periods
     SET status = 'annullato'
   WHERE subscription_id = _subscription_id
     AND status = 'previsto'
     AND period_start >= _effective_date;

  RETURN _row;
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_subscription(uuid, date, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_subscription(uuid, date, text) TO authenticated, service_role;

CREATE OR REPLACE VIEW public.recurring_value_summary AS
WITH canone_corrente AS (
  SELECT
    s.id,
    s.client_id,
    s.status,
    s.periodicity,
    s.end_date,
    s.auto_renew,
    s.notice_days,
    s.cancelled_effective_date,
    a.amount
  FROM public.subscriptions s
  LEFT JOIN public.subscription_amounts a
    ON a.subscription_id = s.id
   AND a.valid_from <= current_date
   AND (a.valid_to IS NULL OR a.valid_to > current_date)
  WHERE s.status IN ('attivo', 'disdettato')
),
normalizzato AS (
  SELECT
    id, client_id, status, end_date, auto_renew, notice_days, cancelled_effective_date,
    CASE periodicity
      WHEN 'mensile' THEN amount
      WHEN 'trimestrale' THEN amount / 3
      WHEN 'annuale' THEN amount / 12
    END AS mensile
  FROM canone_corrente
)
SELECT
  COALESCE(sum(mensile) FILTER (WHERE status = 'attivo'), 0)::numeric(12,2) AS ricorrente_mensile,
  (COALESCE(sum(mensile) FILTER (WHERE status = 'attivo'), 0) * 12)::numeric(12,2) AS ricorrente_annuo,
  count(*) FILTER (WHERE status = 'attivo') AS abbonamenti_attivi,
  COALESCE(sum(mensile) FILTER (
    WHERE status = 'attivo'
      AND end_date IS NOT NULL
      AND (
        (NOT auto_renew AND end_date <= current_date + 90)
        OR (notice_days IS NOT NULL AND end_date - notice_days <= current_date + 90 AND end_date > current_date)
      )
  ), 0)::numeric(12,2) AS mensile_a_rischio_90_giorni,
  COALESCE(sum(mensile) FILTER (WHERE status = 'disdettato'), 0)::numeric(12,2) AS mensile_in_disdetta
FROM normalizzato;

COMMENT ON VIEW public.recurring_value_summary IS 'Valore ricorrente mensile e annuo, e la quota a rischio nei prossimi novanta giorni (FR-30).';

ALTER VIEW public.recurring_value_summary SET (security_invoker = on);
GRANT SELECT ON public.recurring_value_summary TO authenticated;

CREATE OR REPLACE VIEW public.subscription_renewals AS
SELECT
  s.id AS subscription_id,
  s.client_id,
  c.name AS client_name,
  s.description,
  s.periodicity,
  s.end_date,
  s.auto_renew,
  s.notice_days,
  CASE WHEN s.notice_days IS NOT NULL AND s.end_date IS NOT NULL
       THEN s.end_date - s.notice_days
  END AS notice_deadline,
  a.amount AS canone_corrente
FROM public.subscriptions s
JOIN public.clients c ON c.id = s.client_id
LEFT JOIN public.subscription_amounts a
  ON a.subscription_id = s.id
 AND a.valid_from <= current_date
 AND (a.valid_to IS NULL OR a.valid_to > current_date)
WHERE s.status = 'attivo'
  AND s.end_date IS NOT NULL
  AND s.end_date <= current_date + 120;

COMMENT ON VIEW public.subscription_renewals IS 'Abbonamenti in scadenza nei prossimi quattro mesi con la data entro cui va data la disdetta (FR-28).';

ALTER VIEW public.subscription_renewals SET (security_invoker = on);
GRANT SELECT ON public.subscription_renewals TO authenticated;

CREATE OR REPLACE FUNCTION public.notify_subscription_renewals()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _n integer;
  _dest RECORD;
  _inviate integer := 0;
BEGIN
  SELECT count(*) INTO _n
    FROM public.subscription_renewals
   WHERE notice_deadline IS NOT NULL
     AND notice_deadline BETWEEN current_date AND current_date + 30;

  IF _n = 0 THEN
    RETURN 0;
  END IF;

  FOR _dest IN
    SELECT ur.user_id FROM public.user_roles ur
    JOIN public.profiles p ON p.id = ur.user_id
    WHERE ur.role IN ('admin', 'account', 'finance') AND p.approved = true AND p.deleted_at IS NULL
  LOOP
    PERFORM public.notify_user_if_enabled(
      _dest.user_id,
      'subscription_renewal',
      format('%s abbonamenti con preavviso in scadenza', _n),
      format('Per %s abbonamenti il termine per la disdetta cade entro trenta giorni: dopo, il rinnovo e automatico.', _n),
      NULL
    );
    _inviate := _inviate + 1;
  END LOOP;

  RETURN _inviate;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_subscription_renewals() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notify_subscription_renewals() TO service_role;

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_amounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_periods ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.subscriptions FROM anon, authenticated;
REVOKE ALL ON public.subscription_amounts FROM anon, authenticated;
REVOKE ALL ON public.subscription_periods FROM anon, authenticated;

GRANT SELECT, INSERT, DELETE ON public.subscriptions TO authenticated;
GRANT UPDATE (description, periodicity, end_date, auto_renew, notice_days, document_kind, generate_days_before, product_id, offer_id)
  ON public.subscriptions TO authenticated;
GRANT SELECT, INSERT ON public.subscription_amounts TO authenticated;
GRANT SELECT ON public.subscription_periods TO authenticated;

GRANT ALL ON public.subscriptions TO service_role;
GRANT ALL ON public.subscription_amounts TO service_role;
GRANT ALL ON public.subscription_periods TO service_role;

CREATE OR REPLACE FUNCTION public.can_manage_subscriptions()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_approved_user(auth.uid()) AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'account')
    OR public.has_role(auth.uid(), 'finance')
  )
$$;

REVOKE ALL ON FUNCTION public.can_manage_subscriptions() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_subscriptions() TO authenticated, service_role;

CREATE POLICY "Approved users can view subscriptions"
ON public.subscriptions FOR SELECT TO authenticated
USING (public.is_approved_user(auth.uid()));

CREATE POLICY "Commercial roles can create subscriptions"
ON public.subscriptions FOR INSERT TO authenticated
WITH CHECK (public.can_manage_subscriptions());

CREATE POLICY "Commercial roles can update subscriptions"
ON public.subscriptions FOR UPDATE TO authenticated
USING (public.can_manage_subscriptions());

CREATE POLICY "Commercial roles can delete subscriptions without history"
ON public.subscriptions FOR DELETE TO authenticated
USING (
  public.can_manage_subscriptions()
  AND NOT EXISTS (
    SELECT 1 FROM public.subscription_periods sp
     WHERE sp.subscription_id = subscriptions.id AND sp.status <> 'previsto'
  )
);

CREATE POLICY "Approved users can view subscription amounts"
ON public.subscription_amounts FOR SELECT TO authenticated
USING (public.is_approved_user(auth.uid()));

CREATE POLICY "Commercial roles can add subscription amounts"
ON public.subscription_amounts FOR INSERT TO authenticated
WITH CHECK (public.can_manage_subscriptions());

CREATE POLICY "Approved users can view subscription periods"
ON public.subscription_periods FOR SELECT TO authenticated
USING (public.is_approved_user(auth.uid()));