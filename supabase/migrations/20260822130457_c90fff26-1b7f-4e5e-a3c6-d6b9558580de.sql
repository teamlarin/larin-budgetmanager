CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS terms_text text;
COMMENT ON COLUMN public.products.terms_text IS 'Condizioni contrattuali pertinenti a questo prodotto, allegate all''offerta solo quando il prodotto è presente tra le righe (FR-15). NULL = nessuna condizione specifica oltre a quelle generali.';
INSERT INTO public.app_settings (setting_key, setting_value, description) VALUES (
  'offer_general_terms',
  '{"text": ""}'::jsonb,
  'Condizioni generali allegate a ogni offerta, congelate nello snapshot al momento dell''invio (FR-15). Le condizioni specifiche dei singoli prodotti stanno su products.terms_text.'
) ON CONFLICT (setting_key) DO NOTHING;
CREATE TABLE public.offer_public_links (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  offer_id uuid NOT NULL REFERENCES public.offers(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  CONSTRAINT offer_public_links_token_length_check CHECK (length(token) >= 32),
  CONSTRAINT offer_public_links_revoked_shape_check CHECK (
    (revoked_at IS NULL AND revoked_by IS NULL) OR revoked_at IS NOT NULL
  )
);
COMMENT ON TABLE public.offer_public_links IS 'Link pubblici con token verso un''offerta (FR-16). Il token è sull''offerta e non sulla versione: risolve sempre la versione corrente.';
COMMENT ON COLUMN public.offer_public_links.expires_at IS 'Scadenza del link, indipendente da offer_versions.valid_until. NULL = il link non scade da sé.';
CREATE UNIQUE INDEX idx_offer_public_links_one_active_per_offer
  ON public.offer_public_links(offer_id)
  WHERE revoked_at IS NULL;
COMMENT ON INDEX public.idx_offer_public_links_one_active_per_offer IS 'Un solo link attivo per offerta: due link vivi contemporaneamente renderebbero la revoca una falsa sicurezza.';
CREATE INDEX idx_offer_public_links_offer_id ON public.offer_public_links(offer_id);
CREATE TABLE public.offer_public_link_accesses (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  public_link_id uuid NOT NULL REFERENCES public.offer_public_links(id) ON DELETE CASCADE,
  offer_version_id uuid REFERENCES public.offer_versions(id) ON DELETE SET NULL,
  client_ip inet,
  user_agent text,
  outcome text NOT NULL CHECK (outcome IN ('ok', 'revocato', 'scaduto', 'non_trovato')),
  accessed_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.offer_public_link_accesses IS 'Registro di ogni apertura del link pubblico, compresi i tentativi respinti (token revocato o scaduto). Append-only.';
COMMENT ON COLUMN public.offer_public_link_accesses.offer_version_id IS 'Versione mostrata a quell''accesso: cambia nel tempo se nasce una revisione, quindi va registrata per accesso e non dedotta.';
CREATE INDEX idx_offer_public_link_accesses_link_id ON public.offer_public_link_accesses(public_link_id);
CREATE INDEX idx_offer_public_link_accesses_version_id ON public.offer_public_link_accesses(offer_version_id);
CREATE TABLE public.offer_version_documents (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  offer_version_id uuid NOT NULL UNIQUE REFERENCES public.offer_versions(id) ON DELETE CASCADE,
  snapshot jsonb NOT NULL,
  snapshot_hash text NOT NULL,
  frozen_at timestamptz NOT NULL DEFAULT now(),
  pdf_path text,
  pdf_generated_at timestamptz,
  CONSTRAINT offer_version_documents_pdf_shape_check CHECK (
    (pdf_path IS NULL AND pdf_generated_at IS NULL)
    OR (pdf_path IS NOT NULL AND pdf_generated_at IS NOT NULL)
  )
);
COMMENT ON TABLE public.offer_version_documents IS 'Documento congelato di una versione di offerta: lo snapshot jsonb di tutto ciò che il cliente vede più il suo hash sha256.';
COMMENT ON COLUMN public.offer_version_documents.snapshot_hash IS 'sha256 di snapshot::text. È il valore che offer_signatures.document_hash deve riprodurre.';
COMMENT ON COLUMN public.offer_version_documents.pdf_path IS 'Path nel bucket privato offer-documents. NULL finché il PDF non è stato generato.';
CREATE INDEX idx_offer_version_documents_version_id ON public.offer_version_documents(offer_version_id);
CREATE OR REPLACE FUNCTION public.guard_offer_version_document_immutable()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_setting('app.offer_document_write_allowed', true) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION 'offer_version_documents si scrive solo tramite public.freeze_offer_version_document() o public.attach_offer_version_pdf()'
      USING errcode = 'check_violation';
  END IF;
  RETURN CASE WHEN tg_op = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;
CREATE TRIGGER guard_offer_version_documents_write
BEFORE INSERT OR UPDATE OR DELETE ON public.offer_version_documents
FOR EACH ROW EXECUTE FUNCTION public.guard_offer_version_document_immutable();
CREATE TYPE public.offer_client_decision AS ENUM ('accettata', 'rifiutata');
CREATE TABLE public.offer_signatures (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  offer_version_id uuid NOT NULL REFERENCES public.offer_versions(id) ON DELETE CASCADE,
  public_link_id uuid NOT NULL REFERENCES public.offer_public_links(id) ON DELETE RESTRICT,
  decision public.offer_client_decision NOT NULL,
  signer_name text NOT NULL,
  signer_role text,
  signer_email text,
  signature_image_path text,
  document_hash text NOT NULL,
  client_ip inet NOT NULL,
  user_agent text,
  reject_reason text,
  signed_pdf_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT offer_signatures_signer_name_check CHECK (btrim(signer_name) <> ''),
  CONSTRAINT offer_signatures_accepted_needs_signature_check CHECK (
    decision <> 'accettata' OR (signature_image_path IS NOT NULL AND btrim(signature_image_path) <> '')
  )
);
COMMENT ON TABLE public.offer_signatures IS 'Decisione del cliente su una versione di offerta (FR-17, FR-42), con firma disegnata, identità dichiarata e tracce tecniche. Append-only.';
COMMENT ON COLUMN public.offer_signatures.document_hash IS 'Hash del documento effettivamente mostrato al firmatario, copiato da offer_version_documents.snapshot_hash al momento della firma.';
COMMENT ON COLUMN public.offer_signatures.signature_image_path IS 'PNG della firma tracciata, nel bucket privato offer-documents. Obbligatorio per l''accettazione, non per il rifiuto.';
COMMENT ON COLUMN public.offer_signatures.client_ip IS 'IP di provenienza. 0.0.0.0 significa "non rilevabile dagli header della richiesta".';
CREATE UNIQUE INDEX idx_offer_signatures_one_acceptance_per_version
  ON public.offer_signatures(offer_version_id)
  WHERE decision = 'accettata';
COMMENT ON INDEX public.idx_offer_signatures_one_acceptance_per_version IS 'Una sola accettazione per versione, imposta dal database: due click ravvicinati del cliente non producono due firme.';
CREATE INDEX idx_offer_signatures_version_id ON public.offer_signatures(offer_version_id);
CREATE INDEX idx_offer_signatures_link_id ON public.offer_signatures(public_link_id);
CREATE OR REPLACE FUNCTION public.guard_offer_signatures_append_only()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF tg_op = 'UPDATE' THEN
    IF current_setting('app.offer_signature_pdf_write_allowed', true) = 'on'
       AND OLD.signed_pdf_path IS NULL
       AND NEW.signed_pdf_path IS NOT NULL
       AND to_jsonb(NEW) - 'signed_pdf_path' = to_jsonb(OLD) - 'signed_pdf_path' THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'offer_signatures non si modifica: una firma modificabile non è una firma'
      USING errcode = 'check_violation';
  END IF;
  RAISE EXCEPTION 'offer_signatures non si elimina'
    USING errcode = 'check_violation';
END;
$$;
CREATE TRIGGER guard_offer_signatures_append_only
BEFORE UPDATE OR DELETE ON public.offer_signatures
FOR EACH ROW EXECUTE FUNCTION public.guard_offer_signatures_append_only();
CREATE OR REPLACE FUNCTION public.build_offer_version_snapshot(_offer_version_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _snapshot jsonb;
BEGIN
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
               'product_name', p.name,
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
$$;
COMMENT ON FUNCTION public.build_offer_version_snapshot(uuid) IS 'Costruisce il documento jsonb di una versione: tutto ciò che il cliente deve vedere, niente di più.';
REVOKE ALL ON FUNCTION public.build_offer_version_snapshot(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.build_offer_version_snapshot(uuid) TO authenticated, service_role;
CREATE OR REPLACE FUNCTION public.freeze_offer_version_document(_offer_version_id uuid)
RETURNS public.offer_version_documents
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _snapshot jsonb;
  _hash text;
  _row public.offer_version_documents;
BEGIN
  _snapshot := public.build_offer_version_snapshot(_offer_version_id);
  _hash := encode(extensions.digest(_snapshot::text, 'sha256'), 'hex');
  PERFORM set_config('app.offer_document_write_allowed', 'on', true);
  INSERT INTO public.offer_version_documents (offer_version_id, snapshot, snapshot_hash)
  VALUES (_offer_version_id, _snapshot, _hash)
  ON CONFLICT (offer_version_id) DO UPDATE
    SET snapshot = EXCLUDED.snapshot,
        snapshot_hash = EXCLUDED.snapshot_hash,
        frozen_at = now(),
        pdf_path = CASE WHEN public.offer_version_documents.snapshot_hash = EXCLUDED.snapshot_hash
                        THEN public.offer_version_documents.pdf_path ELSE NULL END,
        pdf_generated_at = CASE WHEN public.offer_version_documents.snapshot_hash = EXCLUDED.snapshot_hash
                                THEN public.offer_version_documents.pdf_generated_at ELSE NULL END
  RETURNING * INTO _row;
  PERFORM set_config('app.offer_document_write_allowed', 'off', true);
  RETURN _row;
END;
$$;
COMMENT ON FUNCTION public.freeze_offer_version_document(uuid) IS 'Congela il documento di una versione alla prima uscita dalla bozza.';
REVOKE ALL ON FUNCTION public.freeze_offer_version_document(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.freeze_offer_version_document(uuid) TO service_role;
CREATE OR REPLACE FUNCTION public.attach_offer_version_pdf(
  _offer_version_id uuid,
  _pdf_path text,
  _expected_snapshot_hash text DEFAULT NULL
)
RETURNS public.offer_version_documents
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row public.offer_version_documents;
BEGIN
  SELECT * INTO _row FROM public.offer_version_documents WHERE offer_version_id = _offer_version_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nessun documento congelato per la versione %: il PDF non può precedere lo snapshot', _offer_version_id;
  END IF;
  IF _expected_snapshot_hash IS NOT NULL AND _row.snapshot_hash <> _expected_snapshot_hash THEN
    RAISE EXCEPTION 'Il documento è cambiato mentre il PDF veniva generato (atteso %, corrente %)', _expected_snapshot_hash, _row.snapshot_hash;
  END IF;
  IF _row.pdf_path IS NOT NULL THEN
    RETURN _row;
  END IF;
  PERFORM set_config('app.offer_document_write_allowed', 'on', true);
  UPDATE public.offer_version_documents
     SET pdf_path = _pdf_path,
         pdf_generated_at = now()
   WHERE offer_version_id = _offer_version_id
  RETURNING * INTO _row;
  PERFORM set_config('app.offer_document_write_allowed', 'off', true);
  RETURN _row;
END;
$$;
REVOKE ALL ON FUNCTION public.attach_offer_version_pdf(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.attach_offer_version_pdf(uuid, text, text) TO service_role;
CREATE OR REPLACE FUNCTION public.attach_offer_signature_pdf(_signature_id uuid, _pdf_path text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM set_config('app.offer_signature_pdf_write_allowed', 'on', true);
  UPDATE public.offer_signatures
     SET signed_pdf_path = _pdf_path
   WHERE id = _signature_id
     AND signed_pdf_path IS NULL;
  PERFORM set_config('app.offer_signature_pdf_write_allowed', 'off', true);
END;
$$;
REVOKE ALL ON FUNCTION public.attach_offer_signature_pdf(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.attach_offer_signature_pdf(uuid, text) TO service_role;
CREATE OR REPLACE FUNCTION public.notify_offer_client_activity(
  _offer_version_id uuid,
  _kind text,
  _detail text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _composer_id uuid;
  _account_id uuid;
  _project_id uuid;
  _year integer;
  _number integer;
  _version_number integer;
  _client_name text;
  _offered_total numeric;
  _type text;
  _title text;
  _message text;
  _recipients uuid[];
  _recipient uuid;
  _admin RECORD;
BEGIN
  SELECT ov.created_by, c.account_user_id, o.project_id, o.year, o.number,
         ov.version_number, c.name, ov.offered_total
    INTO _composer_id, _account_id, _project_id, _year, _number,
         _version_number, _client_name, _offered_total
  FROM public.offer_versions ov
  JOIN public.offers o ON o.id = ov.offer_id
  JOIN public.clients c ON c.id = o.client_id
  WHERE ov.id = _offer_version_id;
  IF NOT FOUND THEN
    RETURN;
  END IF;
  IF _kind = 'viewed' THEN
    _type := 'offer_viewed';
    _title := format('Offerta %s/%s aperta dal cliente', _year, _number);
    _message := format('%s ha aperto l''offerta %s/%s (v%s).', _client_name, _year, _number, _version_number);
  ELSIF _kind = 'signed' THEN
    _type := 'offer_signed';
    _title := format('Offerta %s/%s accettata e firmata', _year, _number);
    _message := format('%s ha accettato e firmato l''offerta %s/%s (v%s) per %s €.%s',
                       _client_name, _year, _number, _version_number, _offered_total,
                       CASE WHEN _detail IS NOT NULL THEN ' Firmatario: ' || _detail || '.' ELSE '' END);
  ELSIF _kind = 'rejected' THEN
    _type := 'offer_rejected';
    _title := format('Offerta %s/%s rifiutata dal cliente', _year, _number);
    _message := format('%s ha rifiutato l''offerta %s/%s (v%s).%s',
                       _client_name, _year, _number, _version_number,
                       CASE WHEN _detail IS NOT NULL THEN ' Motivo: ' || _detail || '.' ELSE '' END);
  ELSE
    RAISE EXCEPTION 'Tipo di attività cliente non riconosciuto: %', _kind;
  END IF;
  _recipients := ARRAY[]::uuid[];
  IF _composer_id IS NOT NULL THEN
    _recipients := _recipients || _composer_id;
  END IF;
  IF _account_id IS NOT NULL AND NOT (_account_id = ANY(_recipients)) THEN
    _recipients := _recipients || _account_id;
  END IF;
  IF _kind = 'signed' THEN
    FOR _admin IN
      SELECT ur.user_id
      FROM public.user_roles ur
      JOIN public.profiles p ON p.id = ur.user_id
      WHERE ur.role = 'finance'
        AND p.approved = true
        AND p.deleted_at IS NULL
    LOOP
      IF NOT (_admin.user_id = ANY(_recipients)) THEN
        _recipients := _recipients || _admin.user_id;
      END IF;
    END LOOP;
    IF NOT EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.profiles p ON p.id = ur.user_id
      WHERE ur.role = 'finance' AND p.approved = true AND p.deleted_at IS NULL
    ) THEN
      FOR _admin IN
        SELECT ur.user_id
        FROM public.user_roles ur
        JOIN public.profiles p ON p.id = ur.user_id
        WHERE ur.role = 'admin'
          AND p.approved = true
          AND p.deleted_at IS NULL
      LOOP
        IF NOT (_admin.user_id = ANY(_recipients)) THEN
          _recipients := _recipients || _admin.user_id;
        END IF;
      END LOOP;
    END IF;
  END IF;
  FOREACH _recipient IN ARRAY _recipients LOOP
    PERFORM public.notify_user_if_enabled(_recipient, _type, _title, _message, _project_id);
  END LOOP;
END;
$$;
COMMENT ON FUNCTION public.notify_offer_client_activity(uuid, text, text) IS 'Notifiche di apertura, firma e rifiuto (FR-47).';
REVOKE ALL ON FUNCTION public.notify_offer_client_activity(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notify_offer_client_activity(uuid, text, text) TO service_role;
ALTER TABLE public.offer_public_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offer_public_link_accesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offer_version_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offer_signatures ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.offer_public_links TO authenticated;
GRANT SELECT ON public.offer_public_link_accesses TO authenticated;
GRANT SELECT ON public.offer_version_documents TO authenticated;
GRANT SELECT ON public.offer_signatures TO authenticated;
GRANT ALL ON public.offer_public_links TO service_role;
GRANT ALL ON public.offer_public_link_accesses TO service_role;
GRANT ALL ON public.offer_version_documents TO service_role;
GRANT ALL ON public.offer_signatures TO service_role;
CREATE POLICY "Approved users can view offer public links"
ON public.offer_public_links FOR SELECT TO authenticated
USING (public.is_approved_user(auth.uid()));
CREATE POLICY "Approved users can view offer link accesses"
ON public.offer_public_link_accesses FOR SELECT TO authenticated
USING (public.is_approved_user(auth.uid()));
CREATE POLICY "Approved users can view offer documents"
ON public.offer_version_documents FOR SELECT TO authenticated
USING (public.is_approved_user(auth.uid()));
CREATE POLICY "Approved users can view offer signatures"
ON public.offer_signatures FOR SELECT TO authenticated
USING (public.is_approved_user(auth.uid()));
DROP POLICY IF EXISTS "Approved users can read offer documents" ON storage.objects;
CREATE POLICY "Approved users can read offer documents"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'offer-documents' AND public.is_approved_user(auth.uid()));