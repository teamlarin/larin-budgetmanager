CREATE OR REPLACE FUNCTION public.set_offer_version_status(
  _offer_version_id uuid,
  _new_status public.offer_status,
  _event_type text,
  _actor_type public.offer_event_actor_type,
  _actor_user_id uuid DEFAULT NULL,
  _client_token text DEFAULT NULL,
  _client_ip inet DEFAULT NULL,
  _note text DEFAULT NULL
)
RETURNS public.offer_events
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _old_status public.offer_status;
  _composer_id uuid;
  _final_status public.offer_status;
  _final_event_type text;
  _final_note text;
  _discount_percentage numeric;
  _offered_total numeric;
  _threshold_percentage numeric;
  _threshold_amount numeric;
  _event public.offer_events;
  _signer text;
BEGIN
  IF _actor_type = 'user' THEN
    IF _actor_user_id IS NULL OR _actor_user_id <> auth.uid() THEN
      RAISE EXCEPTION 'actor_user_id deve coincidere con l''utente autenticato corrente';
    END IF;
    IF NOT public.is_approved_user(auth.uid()) THEN
      RAISE EXCEPTION 'Utente non approvato';
    END IF;
  ELSE
    IF auth.role() IS DISTINCT FROM 'service_role' THEN
      RAISE EXCEPTION 'Gli eventi di tipo client o system si registrano solo da un processo di sistema (service role)';
    END IF;
  END IF;
  SELECT status, created_by INTO _old_status, _composer_id
    FROM public.offer_versions
   WHERE id = _offer_version_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Versione offerta % non trovata', _offer_version_id;
  END IF;
  _final_status := _new_status;
  _final_event_type := _event_type;
  _final_note := _note;
  IF _old_status = 'bozza' AND _new_status = 'inviata' AND public.offer_version_requires_approval(_offer_version_id) THEN
    SELECT public.get_offer_version_effective_discount_percentage(_offer_version_id), ov.offered_total
      INTO _discount_percentage, _offered_total
    FROM public.offer_versions ov WHERE ov.id = _offer_version_id;
    SELECT discount_threshold_percentage, amount_threshold INTO _threshold_percentage, _threshold_amount
      FROM public.get_offer_approval_thresholds();
    _final_status := 'in_approvazione';
    _final_event_type := 'in_approvazione';
    _final_note := concat_ws('; ',
      CASE WHEN _discount_percentage > _threshold_percentage THEN
        format('sconto effettivo %s%% oltre la soglia del %s%%', round(_discount_percentage, 2), _threshold_percentage)
      END,
      CASE WHEN _offered_total > _threshold_amount THEN
        format('importo offerto %s € oltre la soglia di %s €', _offered_total, _threshold_amount)
      END,
      _note
    );
  END IF;
  IF _old_status = 'in_approvazione' AND _new_status IN ('inviata', 'bozza') THEN
    IF _actor_type <> 'user' OR NOT public.has_role(_actor_user_id, 'admin') THEN
      RAISE EXCEPTION 'Solo un utente con ruolo admin può approvare o respingere un''offerta in approvazione';
    END IF;
    IF _actor_user_id = _composer_id THEN
      RAISE EXCEPTION 'Chi ha composto l''offerta non può approvarla né respingerla, anche da admin';
    END IF;
    IF _new_status = 'bozza' THEN
      IF _note IS NULL OR btrim(_note) = '' THEN
        RAISE EXCEPTION 'Il rifiuto di un''offerta in approvazione richiede un motivo';
      END IF;
      _final_event_type := 'respinta';
    ELSE
      _final_event_type := 'inviata';
    END IF;
  END IF;
  IF _old_status = 'bozza' AND _final_status <> 'bozza' THEN
    PERFORM public.validate_offer_payment_terms_balance(_offer_version_id);
  END IF;
  PERFORM set_config('app.offer_status_transition_allowed', 'on', true);
  UPDATE public.offer_versions
     SET status = _final_status
   WHERE id = _offer_version_id;
  PERFORM set_config('app.offer_status_transition_allowed', 'off', true);
  IF _old_status = 'bozza' AND _final_status <> 'bozza' THEN
    PERFORM public.freeze_offer_version_document(_offer_version_id);
  END IF;
  INSERT INTO public.offer_events (
    offer_version_id, event_type, previous_status, new_status,
    actor_type, actor_user_id, client_token, client_ip, note
  ) VALUES (
    _offer_version_id, _final_event_type, _old_status, _final_status,
    _actor_type, _actor_user_id, _client_token, _client_ip, _final_note
  )
  RETURNING * INTO _event;
  BEGIN
    IF _old_status = 'bozza' AND _final_status = 'in_approvazione' THEN
      PERFORM public.notify_offer_approval_required(_offer_version_id, _final_note);
    ELSIF _old_status = 'in_approvazione' AND _final_status = 'inviata' THEN
      PERFORM public.notify_offer_approval_outcome(_offer_version_id, true, _final_note);
    ELSIF _old_status = 'in_approvazione' AND _final_status = 'bozza' THEN
      PERFORM public.notify_offer_approval_outcome(_offer_version_id, false, _final_note);
    ELSIF _final_status = 'vista' AND _old_status = 'inviata' THEN
      PERFORM public.notify_offer_client_activity(_offer_version_id, 'viewed');
    ELSIF _final_status = 'accettata' THEN
      SELECT concat_ws(' ', s.signer_name, nullif('(' || s.signer_role || ')', '()'))
        INTO _signer
        FROM public.offer_signatures s
       WHERE s.offer_version_id = _offer_version_id AND s.decision = 'accettata'
       ORDER BY s.created_at DESC LIMIT 1;
      PERFORM public.notify_offer_client_activity(_offer_version_id, 'signed', _signer);
    ELSIF _final_status = 'rifiutata' THEN
      PERFORM public.notify_offer_client_activity(_offer_version_id, 'rejected', _final_note);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Errore nell''invio della notifica per la transizione di %: %', _offer_version_id, SQLERRM;
  END;
  RETURN _event;
END;
$$;
COMMENT ON FUNCTION public.set_offer_version_status(uuid, public.offer_status, text, public.offer_event_actor_type, uuid, text, inet, text) IS 'Unico varco per cambiare offer_versions.status: quadratura, soglie, notifiche interne, congelamento del documento e notifiche di attività cliente.';
REVOKE ALL ON FUNCTION public.set_offer_version_status(
  uuid, public.offer_status, text, public.offer_event_actor_type, uuid, text, inet, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_offer_version_status(
  uuid, public.offer_status, text, public.offer_event_actor_type, uuid, text, inet, text
) TO authenticated, service_role;
CREATE OR REPLACE FUNCTION public.create_offer_public_link(
  _offer_id uuid,
  _expires_in_days integer DEFAULT NULL
)
RETURNS public.offer_public_links
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row public.offer_public_links;
  _has_sent_version boolean;
BEGIN
  IF NOT public.can_manage_offer(_offer_id) THEN
    RAISE EXCEPTION 'Non autorizzato a generare il link di questa offerta';
  END IF;
  SELECT EXISTS (
    SELECT 1 FROM public.offer_versions ov
    WHERE ov.offer_id = _offer_id AND ov.status <> 'bozza'
  ) INTO _has_sent_version;
  IF NOT _has_sent_version THEN
    RAISE EXCEPTION 'L''offerta non ha nessuna versione uscita dalla bozza: inviala prima di generare il link';
  END IF;
  UPDATE public.offer_public_links
     SET revoked_at = now(), revoked_by = auth.uid()
   WHERE offer_id = _offer_id AND revoked_at IS NULL;
  INSERT INTO public.offer_public_links (offer_id, token, created_by, expires_at)
  VALUES (
    _offer_id,
    encode(extensions.gen_random_bytes(32), 'hex'),
    auth.uid(),
    CASE WHEN _expires_in_days IS NOT NULL THEN now() + make_interval(days => _expires_in_days) END
  )
  RETURNING * INTO _row;
  RETURN _row;
END;
$$;
COMMENT ON FUNCTION public.create_offer_public_link(uuid, integer) IS 'Genera il link pubblico di un''offerta, revocando quello attivo. Richiede almeno una versione uscita dalla bozza.';
REVOKE ALL ON FUNCTION public.create_offer_public_link(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_offer_public_link(uuid, integer) TO authenticated, service_role;
CREATE OR REPLACE FUNCTION public.revoke_offer_public_link(_public_link_id uuid)
RETURNS public.offer_public_links
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row public.offer_public_links;
  _offer_id uuid;
BEGIN
  SELECT offer_id INTO _offer_id FROM public.offer_public_links WHERE id = _public_link_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Link % non trovato', _public_link_id;
  END IF;
  IF NOT public.can_manage_offer(_offer_id) THEN
    RAISE EXCEPTION 'Non autorizzato a revocare il link di questa offerta';
  END IF;
  UPDATE public.offer_public_links
     SET revoked_at = COALESCE(revoked_at, now()),
         revoked_by = COALESCE(revoked_by, auth.uid())
   WHERE id = _public_link_id
  RETURNING * INTO _row;
  RETURN _row;
END;
$$;
REVOKE ALL ON FUNCTION public.revoke_offer_public_link(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.revoke_offer_public_link(uuid) TO authenticated, service_role;
CREATE OR REPLACE FUNCTION public.resolve_offer_public_link(
  _token text,
  _client_ip inet DEFAULT NULL,
  _user_agent text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _link public.offer_public_links;
  _offer public.offers;
  _version public.offer_versions;
  _document public.offer_version_documents;
  _signature public.offer_signatures;
  _ip inet;
  _outcome text;
  _signable boolean;
  _reason text;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'La risoluzione del link pubblico passa solo da un processo di sistema (service role)';
  END IF;
  _ip := COALESCE(_client_ip, '0.0.0.0'::inet);
  SELECT * INTO _link FROM public.offer_public_links WHERE token = _token;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('outcome', 'non_trovato');
  END IF;
  IF _link.revoked_at IS NOT NULL THEN
    _outcome := 'revocato';
  ELSIF _link.expires_at IS NOT NULL AND _link.expires_at < now() THEN
    _outcome := 'scaduto';
  ELSE
    _outcome := 'ok';
  END IF;
  SELECT * INTO _offer FROM public.offers WHERE id = _link.offer_id;
  SELECT * INTO _version FROM public.offer_versions WHERE id = _offer.current_version_id;
  INSERT INTO public.offer_public_link_accesses (public_link_id, offer_version_id, client_ip, user_agent, outcome)
  VALUES (_link.id, _version.id, _ip, _user_agent, _outcome);
  IF _outcome <> 'ok' THEN
    RETURN jsonb_build_object('outcome', _outcome);
  END IF;
  IF _version.id IS NULL THEN
    RETURN jsonb_build_object('outcome', 'non_trovato');
  END IF;
  IF _version.valid_until IS NOT NULL
     AND _version.valid_until < current_date
     AND _version.status IN ('inviata', 'vista') THEN
    PERFORM public.set_offer_version_status(
      _version.id, 'scaduta', 'scaduta', 'system', NULL, NULL, NULL,
      format('validità superata il %s', _version.valid_until)
    );
    SELECT * INTO _version FROM public.offer_versions WHERE id = _version.id;
  END IF;
  IF _version.status = 'inviata' THEN
    PERFORM public.set_offer_version_status(
      _version.id, 'vista', 'vista', 'client', NULL, _token, _ip, NULL
    );
    SELECT * INTO _version FROM public.offer_versions WHERE id = _version.id;
  END IF;
  SELECT * INTO _document FROM public.offer_version_documents WHERE offer_version_id = _version.id;
  IF _document.id IS NULL THEN
    RETURN jsonb_build_object('outcome', 'documento_assente');
  END IF;
  SELECT * INTO _signature
    FROM public.offer_signatures
   WHERE offer_version_id = _version.id
   ORDER BY created_at DESC LIMIT 1;
  _signable := _version.status IN ('inviata', 'vista');
  _reason := CASE
    WHEN _signable THEN NULL
    WHEN _version.status = 'accettata' THEN 'Questa offerta è già stata accettata.'
    WHEN _version.status = 'rifiutata' THEN 'Questa offerta è stata rifiutata.'
    WHEN _version.status = 'scaduta' THEN 'Questa offerta è scaduta: chiedici una nuova proposta.'
    WHEN _version.status IN ('superata', 'sostituita') THEN 'Esiste una versione più recente di questa offerta.'
    ELSE 'Questa offerta non è al momento accettabile.'
  END;
  RETURN jsonb_build_object(
    'outcome', 'ok',
    'offer_version_id', _version.id,
    'status', _version.status,
    'signable', _signable,
    'not_signable_reason', _reason,
    'document_hash', _document.snapshot_hash,
    'has_pdf', _document.pdf_path IS NOT NULL,
    'pdf_path', _document.pdf_path,
    'document', _document.snapshot,
    'signature', CASE WHEN _signature.id IS NULL THEN NULL ELSE jsonb_build_object(
      'decision', _signature.decision,
      'signer_name', _signature.signer_name,
      'signer_role', _signature.signer_role,
      'signed_at', _signature.created_at
    ) END
  );
END;
$$;
COMMENT ON FUNCTION public.resolve_offer_public_link(text, inet, text) IS 'Risolve il token del link pubblico e restituisce il documento congelato della versione corrente. Solo service role.';
REVOKE ALL ON FUNCTION public.resolve_offer_public_link(text, inet, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_offer_public_link(text, inet, text) TO service_role;
CREATE OR REPLACE FUNCTION public.record_offer_client_decision(
  _token text,
  _decision public.offer_client_decision,
  _signer_name text,
  _expected_document_hash text,
  _client_ip inet DEFAULT NULL,
  _user_agent text DEFAULT NULL,
  _signer_role text DEFAULT NULL,
  _signer_email text DEFAULT NULL,
  _signature_image_path text DEFAULT NULL,
  _reject_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    RAISE EXCEPTION 'La versione non è accettabile nello stato %', _version.status
      USING errcode = 'check_violation';
  END IF;
  SELECT * INTO _document FROM public.offer_version_documents WHERE offer_version_id = _version.id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Documento congelato assente per la versione %', _version.id;
  END IF;
  IF _document.snapshot_hash <> _expected_document_hash THEN
    RAISE EXCEPTION 'Il documento è cambiato da quando è stato aperto: ricaricare la pagina prima di firmare'
      USING errcode = 'check_violation';
  END IF;
  IF _decision = 'accettata' AND (_signature_image_path IS NULL OR btrim(_signature_image_path) = '') THEN
    RAISE EXCEPTION 'L''accettazione richiede la firma';
  END IF;
  INSERT INTO public.offer_signatures (
    offer_version_id, public_link_id, decision, signer_name, signer_role, signer_email,
    signature_image_path, document_hash, client_ip, user_agent, reject_reason
  ) VALUES (
    _version.id, _link.id, _decision, btrim(_signer_name), nullif(btrim(_signer_role), ''), nullif(btrim(_signer_email), ''),
    _signature_image_path, _document.snapshot_hash, _ip, _user_agent, nullif(btrim(_reject_reason), '')
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
$$;
COMMENT ON FUNCTION public.record_offer_client_decision(text, public.offer_client_decision, text, text, inet, text, text, text, text, text) IS 'Registra accettazione (con firma obbligatoria) o rifiuto del cliente, verificando token, stato e hash del documento visto.';
REVOKE ALL ON FUNCTION public.record_offer_client_decision(text, public.offer_client_decision, text, text, inet, text, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_offer_client_decision(text, public.offer_client_decision, text, text, inet, text, text, text, text, text) TO service_role;
DO $$
DECLARE
  _v RECORD;
BEGIN
  FOR _v IN
    SELECT ov.id
    FROM public.offer_versions ov
    LEFT JOIN public.offer_version_documents d ON d.offer_version_id = ov.id
    WHERE ov.status <> 'bozza' AND d.id IS NULL
  LOOP
    PERFORM public.freeze_offer_version_document(_v.id);
  END LOOP;
END $$;