ALTER TABLE public.offer_signatures
  ADD COLUMN IF NOT EXISTS signature_source text,
  ADD COLUMN IF NOT EXISTS terms_acknowledged_at timestamptz,
  ADD COLUMN IF NOT EXISTS offer_accepted_at timestamptz;

ALTER TABLE public.offer_signatures
  DROP CONSTRAINT IF EXISTS offer_signatures_signature_source_check;
ALTER TABLE public.offer_signatures
  ADD CONSTRAINT offer_signatures_signature_source_check
  CHECK (signature_source IS NULL OR signature_source IN ('drawn', 'uploaded'));

CREATE OR REPLACE FUNCTION public.record_offer_client_decision(
  _token text,
  _decision offer_client_decision,
  _signer_name text,
  _expected_document_hash text,
  _client_ip inet DEFAULT NULL::inet,
  _user_agent text DEFAULT NULL::text,
  _signer_role text DEFAULT NULL::text,
  _signer_email text DEFAULT NULL::text,
  _signature_image_path text DEFAULT NULL::text,
  _reject_reason text DEFAULT NULL::text,
  _signature_source text DEFAULT NULL::text,
  _terms_acknowledged_at timestamptz DEFAULT NULL::timestamptz,
  _offer_accepted_at timestamptz DEFAULT NULL::timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _link public.offer_public_links;
  _offer public.offers;
  _version public.offer_versions;
  _document public.offer_version_documents;
  _signature public.offer_signatures;
  _ip inet;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'La decisione del cliente si registra solo da un processo di sistema (service role)';
  END IF;

  _ip := COALESCE(_client_ip, '0.0.0.0'::inet);

  SELECT * INTO _link FROM public.offer_public_links WHERE token = _token;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Link non valido';
  END IF;
  IF _link.revoked_at IS NOT NULL THEN
    RAISE EXCEPTION 'Link revocato';
  END IF;
  IF _link.expires_at IS NOT NULL AND _link.expires_at < now() THEN
    RAISE EXCEPTION 'Link scaduto';
  END IF;

  SELECT * INTO _offer FROM public.offers WHERE id = _link.offer_id;

  SELECT * INTO _version
    FROM public.offer_versions
   WHERE id = _offer.current_version_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Questa offerta non ha una versione corrente';
  END IF;

  IF _version.status NOT IN ('inviata', 'vista') THEN
    RAISE EXCEPTION 'La versione non e accettabile nello stato %', _version.status
      USING errcode = 'check_violation';
  END IF;

  SELECT * INTO _document FROM public.offer_version_documents WHERE offer_version_id = _version.id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Documento congelato assente per la versione %', _version.id;
  END IF;

  IF _document.snapshot_hash <> _expected_document_hash THEN
    RAISE EXCEPTION 'Il documento e cambiato da quando e stato aperto: ricaricare la pagina prima di firmare'
      USING errcode = 'check_violation';
  END IF;

  IF _decision = 'accettata'
     AND _offer.origin <> 'tender'
     AND (_signature_image_path IS NULL OR btrim(_signature_image_path) = '') THEN
    RAISE EXCEPTION 'L''accettazione richiede la firma';
  END IF;

  IF _signature_source IS NOT NULL AND _signature_source NOT IN ('drawn', 'uploaded') THEN
    RAISE EXCEPTION 'Origine della firma non riconosciuta: %', _signature_source
      USING errcode = 'check_violation';
  END IF;

  INSERT INTO public.offer_signatures (
    offer_version_id, public_link_id, decision, signer_name, signer_role, signer_email,
    signature_image_path, document_hash, client_ip, user_agent, reject_reason,
    signature_source, terms_acknowledged_at, offer_accepted_at
  ) VALUES (
    _version.id, _link.id, _decision, btrim(_signer_name), nullif(btrim(_signer_role), ''), nullif(btrim(_signer_email), ''),
    _signature_image_path, _document.snapshot_hash, _ip, _user_agent, nullif(btrim(_reject_reason), ''),
    CASE WHEN _decision = 'accettata' THEN _signature_source ELSE NULL END,
    CASE WHEN _decision = 'accettata' THEN _terms_acknowledged_at ELSE NULL END,
    CASE WHEN _decision = 'accettata' THEN _offer_accepted_at ELSE NULL END
  )
  RETURNING * INTO _signature;

  PERFORM public.set_offer_version_status(
    _version.id,
    CASE WHEN _decision = 'accettata' THEN 'accettata'::public.offer_status ELSE 'rifiutata'::public.offer_status END,
    CASE WHEN _decision = 'accettata' THEN 'firmata' ELSE 'rifiutata' END,
    'client', NULL, _token, _ip,
    CASE WHEN _decision = 'accettata'
         THEN format('firmata da %s%s', btrim(_signer_name), COALESCE(' (' || nullif(btrim(_signer_role), '') || ')', ''))
         ELSE nullif(btrim(_reject_reason), '') END
  );

  RETURN jsonb_build_object(
    'signature_id', _signature.id,
    'offer_version_id', _version.id,
    'decision', _signature.decision,
    'document_hash', _signature.document_hash
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.record_offer_client_decision(text, offer_client_decision, text, text, inet, text, text, text, text, text, text, timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_offer_client_decision(text, offer_client_decision, text, text, inet, text, text, text, text, text, text, timestamptz, timestamptz) TO service_role;

CREATE OR REPLACE FUNCTION public.build_offer_version_snapshot(_offer_version_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _snapshot jsonb;
  _terms_setting jsonb;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' AND NOT public.is_approved_user(auth.uid()) THEN
    RAISE EXCEPTION 'Non autorizzato a leggere il documento di questa offerta';
  END IF;

  SELECT setting_value INTO _terms_setting
    FROM public.app_settings
   WHERE setting_key = 'offer_general_terms';

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
      'general', COALESCE(_terms_setting->>'text', ''),
      'articles', COALESCE(_terms_setting->'articles', '[]'::jsonb),
      'payment_details', COALESCE(_terms_setting->>'payment_details', ''),
      'privacy_note', COALESCE(_terms_setting->>'privacy_note', ''),
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

REVOKE ALL ON FUNCTION public.build_offer_version_snapshot(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.build_offer_version_snapshot(uuid) TO authenticated, service_role;