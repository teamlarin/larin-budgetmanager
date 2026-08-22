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
  _esistente public.offer_version_documents;
BEGIN
  SELECT * INTO _esistente FROM public.offer_version_documents WHERE offer_version_id = _offer_version_id;
  IF FOUND AND EXISTS (SELECT 1 FROM public.offer_signatures s WHERE s.offer_version_id = _offer_version_id) THEN
    RAISE EXCEPTION 'Il documento di una versione già firmata non si rigenera: creare una versione nuova'
      USING errcode = 'check_violation';
  END IF;
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
REVOKE ALL ON FUNCTION public.freeze_offer_version_document(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.freeze_offer_version_document(uuid) TO service_role;
CREATE OR REPLACE FUNCTION public.assert_offer_transition_allowed(
  _old_status public.offer_status,
  _new_status public.offer_status
)
RETURNS void
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF _old_status = _new_status THEN
    RETURN;
  END IF;
  IF _new_status = 'bozza' AND _old_status <> 'in_approvazione' THEN
    RAISE EXCEPTION 'Una versione in stato % non torna in bozza: la revisione si fa creando una versione nuova', _old_status
      USING errcode = 'check_violation',
            hint = 'Il ritorno in bozza esiste solo per l''offerta respinta in approvazione';
  END IF;
  IF _old_status IN ('accettata', 'rifiutata', 'scaduta', 'sostituita', 'superata')
     AND _new_status NOT IN ('sostituita', 'superata') THEN
    RAISE EXCEPTION 'Una versione in stato % non può passare a %', _old_status, _new_status
      USING errcode = 'check_violation';
  END IF;
END;
$$;
COMMENT ON FUNCTION public.assert_offer_transition_allowed(public.offer_status, public.offer_status) IS 'Chiude il grafo degli stati: dice da dove si può arrivare, mentre assert_offer_transition_actor dice chi può farlo. Insieme impediscono che un contratto firmato venga riaperto e riscritto.';
REVOKE ALL ON FUNCTION public.assert_offer_transition_allowed(public.offer_status, public.offer_status) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assert_offer_transition_allowed(public.offer_status, public.offer_status) TO authenticated, service_role;
CREATE OR REPLACE FUNCTION public.restore_accepted_version_as_current(_offer_id uuid, _dead_version_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _accettata uuid;
BEGIN
  SELECT id INTO _accettata
    FROM public.offer_versions
   WHERE offer_id = _offer_id
     AND id <> _dead_version_id
     AND status = 'accettata'
   ORDER BY version_number DESC
   LIMIT 1;
  IF _accettata IS NOT NULL THEN
    UPDATE public.offers SET current_version_id = _accettata WHERE id = _offer_id;
  END IF;
END;
$$;
COMMENT ON FUNCTION public.restore_accepted_version_as_current(uuid, uuid) IS 'Quando la versione corrente muore (rifiutata o scaduta) senza essere stata accettata, e sotto di lei esiste un contratto ancora in vigore, il link pubblico deve tornare a mostrare quello: altrimenti il cliente legge "offerta rifiutata" mentre ha un contratto firmato con noi.';
REVOKE ALL ON FUNCTION public.restore_accepted_version_as_current(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.restore_accepted_version_as_current(uuid, uuid) TO service_role;
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
  _offer_id uuid;
  _current_version_id uuid;
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
    IF NOT public.can_manage_offer_version(_offer_version_id) THEN
      RAISE EXCEPTION 'Non autorizzato a cambiare lo stato di questa offerta';
    END IF;
  ELSE
    IF auth.role() IS DISTINCT FROM 'service_role' THEN
      RAISE EXCEPTION 'Gli eventi di tipo client o system si registrano solo da un processo di sistema (service role)';
    END IF;
  END IF;
  PERFORM public.assert_offer_transition_actor(_new_status, _actor_type);
  SELECT ov.status, ov.created_by, ov.offer_id INTO _old_status, _composer_id, _offer_id
    FROM public.offer_versions ov
   WHERE ov.id = _offer_version_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Versione offerta % non trovata', _offer_version_id;
  END IF;
  PERFORM public.assert_offer_transition_allowed(_old_status, _new_status);
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
  IF _new_status IN ('accettata', 'rifiutata') THEN
    SELECT current_version_id INTO _current_version_id FROM public.offers WHERE id = _offer_id;
    IF _current_version_id IS DISTINCT FROM _offer_version_id THEN
      RAISE EXCEPTION 'Solo la versione corrente di un''offerta può essere accettata o rifiutata'
        USING errcode = 'check_violation';
    END IF;
    IF _old_status NOT IN ('inviata', 'vista') THEN
      RAISE EXCEPTION 'Una versione in stato % non è accettabile né rifiutabile', _old_status
        USING errcode = 'check_violation';
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
  IF _final_status = 'inviata' THEN
    UPDATE public.offers SET current_version_id = _offer_version_id WHERE id = _offer_id;
    PERFORM public.supersede_other_offer_versions(_offer_id, _offer_version_id, false);
  ELSIF _final_status = 'accettata' THEN
    PERFORM public.supersede_other_offer_versions(_offer_id, _offer_version_id, true);
  ELSIF _final_status IN ('rifiutata', 'scaduta') THEN
    PERFORM public.restore_accepted_version_as_current(_offer_id, _offer_version_id);
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
COMMENT ON FUNCTION public.set_offer_version_status(uuid, public.offer_status, text, public.offer_event_actor_type, uuid, text, inet, text) IS 'Unico varco per cambiare offer_versions.status. Verifica chi è l''attore, che abbia titolo sull''offerta, e che la coppia (stato di partenza, stato di arrivo) sia ammessa. Un contratto firmato non torna in bozza. Congela il documento, muove il puntatore alla versione corrente e lo riporta al contratto in vigore quando una revisione muore, e notifica.';
REVOKE ALL ON FUNCTION public.set_offer_version_status(
  uuid, public.offer_status, text, public.offer_event_actor_type, uuid, text, inet, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_offer_version_status(
  uuid, public.offer_status, text, public.offer_event_actor_type, uuid, text, inet, text
) TO authenticated, service_role;
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
  _fallback RECORD;
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
  _recipients := ARRAY(
    SELECT p.id FROM public.profiles p
     WHERE p.id IN (_composer_id, _account_id)
       AND p.approved = true
       AND p.deleted_at IS NULL
  );
  IF _kind = 'signed' OR cardinality(_recipients) = 0 THEN
    FOR _fallback IN
      SELECT ur.user_id
      FROM public.user_roles ur
      JOIN public.profiles p ON p.id = ur.user_id
      WHERE ur.role = 'finance' AND p.approved = true AND p.deleted_at IS NULL
    LOOP
      IF NOT (_fallback.user_id = ANY(_recipients)) THEN
        _recipients := _recipients || _fallback.user_id;
      END IF;
    END LOOP;
    IF cardinality(_recipients) = 0 THEN
      FOR _fallback IN
        SELECT ur.user_id
        FROM public.user_roles ur
        JOIN public.profiles p ON p.id = ur.user_id
        WHERE ur.role = 'admin' AND p.approved = true AND p.deleted_at IS NULL
      LOOP
        _recipients := _recipients || _fallback.user_id;
      END LOOP;
    END IF;
  END IF;
  FOREACH _recipient IN ARRAY _recipients LOOP
    PERFORM public.notify_user_if_enabled(_recipient, _type, _title, _message, _project_id);
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public.notify_offer_client_activity(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notify_offer_client_activity(uuid, text, text) TO service_role;