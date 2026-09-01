CREATE OR REPLACE FUNCTION public.build_offer_version_snapshot(_offer_version_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  _snapshot jsonb;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' AND NOT public.is_approved_user(auth.uid()) THEN
    RAISE EXCEPTION 'Non autorizzato a leggere il documento di questa offerta';
  END IF;
  SELECT jsonb_build_object(
    'schema_version', 1,
    'offer', jsonb_build_object(
      'id', o.id,
      'year', o.year,
      'number', o.number,
      'reference', format('%s/%s', o.year, o.number),
      'origin', o.origin
    ),
    'client', jsonb_build_object(
      'id', c.id,
      'name', c.name,
      'email', c.email
    ),
    'version', jsonb_build_object(
      'id', ov.id,
      'version_number', ov.version_number,
      'billing_mode', ov.billing_mode,
      'list_total', ov.list_total,
      'offered_total', ov.offered_total,
      'effective_discount_percentage', round(public.get_offer_version_effective_discount_percentage(ov.id), 2),
      'payment_terms_text', ov.payment_terms,
      'valid_until', ov.valid_until
    ),
    'lines', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'description', l.description,
               'product_code', p.code,
               -- Titolo mostrato al cliente: quello modificabile sulla riga,
               -- con fallback sul nome di listino (righe storiche).
               'product_name', COALESCE(NULLIF(btrim(l.product_name), ''), p.name, l.description),
               'revenue_category', l.revenue_category,
               'quantity', l.quantity,
               'unit_list_price', l.unit_list_price,
               'discount_percentage', l.discount_percentage,
               'vat_rate', l.vat_rate,
               'line_total', l.line_total
             ) ORDER BY l.display_order, l.description)
        FROM public.offer_lines l
        LEFT JOIN public.products p ON p.id = l.product_id
       WHERE l.offer_version_id = ov.id
    ), '[]'::jsonb),
    'payment_plan', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'amount', t.amount,
               'percentage', t.percentage,
               'maturity_event', t.maturity_event,
               'scheduled_date', t.scheduled_date,
               'phase_label', t.phase_label,
               'payment_term_label', pt.label,
               'payment_term_days', pt.days,
               'payment_term_due_basis', pt.due_basis
             ) ORDER BY t.display_order, t.created_at)
        FROM public.offer_payment_terms t
        JOIN public.payment_terms pt ON pt.id = t.payment_term_id
       WHERE t.offer_version_id = ov.id
    ), '[]'::jsonb),
    'terms', jsonb_build_object(
      'general', COALESCE((SELECT setting_value->>'text' FROM public.app_settings WHERE setting_key = 'offer_general_terms'), ''),
      'specific', COALESCE((
        SELECT jsonb_agg(DISTINCT jsonb_build_object('product_name', p.name, 'text', p.terms_text))
          FROM public.offer_lines l
          JOIN public.products p ON p.id = l.product_id
         WHERE l.offer_version_id = ov.id
           AND p.terms_text IS NOT NULL
           AND btrim(p.terms_text) <> ''
      ), '[]'::jsonb)
    )
  )
  INTO _snapshot
  FROM public.offer_versions ov
  JOIN public.offers o ON o.id = ov.offer_id
  JOIN public.clients c ON c.id = o.client_id
  WHERE ov.id = _offer_version_id;
  IF _snapshot IS NULL THEN
    RAISE EXCEPTION 'Versione offerta % non trovata', _offer_version_id;
  END IF;
  RETURN _snapshot;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.build_offer_version_snapshot(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.build_offer_version_snapshot(uuid) TO authenticated, service_role;