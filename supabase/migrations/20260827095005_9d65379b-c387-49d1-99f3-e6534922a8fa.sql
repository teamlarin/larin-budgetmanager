-- 1. offer_signatures: consenti firme registrate manualmente (senza link pubblico)
ALTER TABLE public.offer_signatures
  ALTER COLUMN public_link_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS recorded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS signed_at timestamptz;

ALTER TABLE public.offer_signatures
  ADD CONSTRAINT offer_signatures_source_ck CHECK (
    (public_link_id IS NOT NULL AND recorded_by IS NULL)
    OR (public_link_id IS NULL AND recorded_by IS NOT NULL)
  );

-- 2. La firma tracciata resta obbligatoria solo per le firme dal link pubblico
CREATE OR REPLACE FUNCTION public.guard_signature_required_unless_tender()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  _origin public.offer_origin;
BEGIN
  SELECT o.origin INTO _origin
    FROM public.offers o
    JOIN public.offer_versions v ON v.offer_id = o.id
   WHERE v.id = NEW.offer_version_id;

  IF NEW.decision = 'accettata'
     AND _origin <> 'tender'
     AND NEW.recorded_by IS NULL
     AND (NEW.signature_image_path IS NULL OR btrim(NEW.signature_image_path) = '') THEN
    RAISE EXCEPTION 'L''accettazione di un''offerta commerciale richiede la firma tracciata'
      USING errcode = 'check_violation';
  END IF;

  RETURN NEW;
END;
$function$;

-- 3. Attore ammesso: accettata/rifiutata da utente interno solo nel percorso manuale dedicato
CREATE OR REPLACE FUNCTION public.assert_offer_transition_actor(_new_status offer_status, _actor_type offer_event_actor_type)
RETURNS void
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $function$
BEGIN
  IF _new_status IN ('vista', 'accettata', 'rifiutata') AND _actor_type <> 'client' THEN
    IF NOT (_new_status IN ('accettata', 'rifiutata')
            AND _actor_type = 'user'
            AND coalesce(current_setting('app.offer_manual_decision', true), 'off') = 'on') THEN
      RAISE EXCEPTION 'Lo stato % lo determina il cliente dal link pubblico, non un utente interno né un automatismo', _new_status
        USING errcode = 'check_violation',
              hint = 'Per registrare un''accettazione avvenuta fuori dal link usa public.record_offer_manual_decision()';
    END IF;
  END IF;
  IF _new_status IN ('scaduta', 'superata', 'sostituita') AND _actor_type <> 'system' THEN
    RAISE EXCEPTION 'Lo stato % è una conseguenza, non una scelta: lo scrive il sistema', _new_status
      USING errcode = 'check_violation';
  END IF;
  IF _new_status IN ('bozza', 'in_approvazione', 'inviata') AND _actor_type = 'client' THEN
    RAISE EXCEPTION 'Il cliente non compone né invia le offerte'
      USING errcode = 'check_violation';
  END IF;
END;
$function$;

-- 4. set_offer_version_status: nel percorso manuale non si passa dall'approvazione interna
CREATE OR REPLACE FUNCTION public.set_offer_version_status(_offer_version_id uuid, _new_status offer_status, _event_type text, _actor_type offer_event_actor_type, _actor_user_id uuid DEFAULT NULL::uuid, _client_token text DEFAULT NULL::text, _client_ip inet DEFAULT NULL::inet, _note text DEFAULT NULL::text)
RETURNS offer_events
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
  _manual boolean := coalesce(current_setting('app.offer_manual_decision', true), 'off') = 'on';
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
  IF _old_status = 'bozza' AND _new_status = 'inviata' AND NOT _manual AND public.offer_version_requires_approval(_offer_version_id) THEN
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
$function$;

-- 5. Registrazione manuale dell'esito (offerte firmate fuori dal link pubblico)
CREATE OR REPLACE FUNCTION public.record_offer_manual_decision(
  _offer_version_id uuid,
  _decision public.offer_client_decision,
  _signer_name text,
  _signer_role text DEFAULT NULL,
  _signer_email text DEFAULT NULL,
  _signed_at timestamptz DEFAULT now(),
  _note text DEFAULT NULL,
  _reject_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _actor uuid := auth.uid();
  _status public.offer_status;
  _document public.offer_version_documents;
  _signature public.offer_signatures;
  _recorder text;
  _matured integer := 0;
  _final_note text;
BEGIN
  IF _actor IS NULL THEN
    RAISE EXCEPTION 'Utente non autenticato';
  END IF;
  IF NOT public.is_approved_user(_actor) THEN
    RAISE EXCEPTION 'Utente non approvato';
  END IF;
  IF NOT public.can_manage_offer_version(_offer_version_id) THEN
    RAISE EXCEPTION 'Non autorizzato a registrare l''esito di questa offerta';
  END IF;
  IF coalesce(btrim(_signer_name), '') = '' THEN
    RAISE EXCEPTION 'Serve il nome di chi ha firmato o comunicato la decisione';
  END IF;
  IF _decision = 'rifiutata' AND coalesce(btrim(_reject_reason), '') = '' THEN
    RAISE EXCEPTION 'Il rifiuto richiede un motivo';
  END IF;

  SELECT status INTO _status FROM public.offer_versions WHERE id = _offer_version_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Versione offerta % non trovata', _offer_version_id;
  END IF;
  IF _status NOT IN ('bozza', 'inviata', 'vista') THEN
    RAISE EXCEPTION 'Una versione in stato % non accetta la registrazione manuale di un esito', _status
      USING errcode = 'check_violation',
            hint = 'Sono registrabili manualmente solo le versioni in bozza, inviate o viste';
  END IF;

  SELECT concat_ws(' ', p.first_name, p.last_name) INTO _recorder
    FROM public.profiles p WHERE p.id = _actor;
  _recorder := nullif(btrim(coalesce(_recorder, '')), '');

  PERFORM set_config('app.offer_manual_decision', 'on', true);

  IF _status = 'bozza' THEN
    PERFORM public.set_offer_version_status(
      _offer_version_id, 'inviata', 'inviata', 'user', _actor, NULL, NULL,
      concat_ws(': ', 'esito registrato manualmente', coalesce(_recorder, 'utente interno'))
    );
  END IF;

  SELECT * INTO _document FROM public.offer_version_documents WHERE offer_version_id = _offer_version_id;
  IF NOT FOUND THEN
    _document := public.freeze_offer_version_document(_offer_version_id);
  END IF;

  INSERT INTO public.offer_signatures (
    offer_version_id, public_link_id, decision, signer_name, signer_role, signer_email,
    document_hash, client_ip, reject_reason, recorded_by, signed_at
  ) VALUES (
    _offer_version_id, NULL, _decision, btrim(_signer_name),
    nullif(btrim(coalesce(_signer_role, '')), ''), nullif(btrim(coalesce(_signer_email, '')), ''),
    _document.snapshot_hash, '0.0.0.0'::inet, nullif(btrim(coalesce(_reject_reason, '')), ''),
    _actor, coalesce(_signed_at, now())
  )
  RETURNING * INTO _signature;

  _final_note := concat_ws('; ',
    format('%s registrata manualmente da %s (firmatario: %s)',
           CASE WHEN _decision = 'accettata' THEN 'Accettazione' ELSE 'Rifiuto' END,
           coalesce(_recorder, 'utente interno'),
           btrim(_signer_name)),
    nullif(btrim(coalesce(_reject_reason, '')), ''),
    nullif(btrim(coalesce(_note, '')), '')
  );

  PERFORM public.set_offer_version_status(
    _offer_version_id,
    CASE WHEN _decision = 'accettata' THEN 'accettata'::public.offer_status ELSE 'rifiutata'::public.offer_status END,
    CASE WHEN _decision = 'accettata' THEN 'firmata' ELSE 'rifiutata' END,
    'user', _actor, NULL, NULL, _final_note
  );

  IF _decision = 'accettata' THEN
    _matured := public.mature_signature_payment_terms(_offer_version_id);
  END IF;

  PERFORM set_config('app.offer_manual_decision', 'off', true);

  RETURN jsonb_build_object(
    'signature_id', _signature.id,
    'offer_version_id', _offer_version_id,
    'decision', _signature.decision,
    'document_hash', _signature.document_hash,
    'matured_payment_terms', _matured
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.record_offer_manual_decision(uuid, public.offer_client_decision, text, text, text, timestamptz, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_offer_manual_decision(uuid, public.offer_client_decision, text, text, text, timestamptz, text, text) TO authenticated, service_role;