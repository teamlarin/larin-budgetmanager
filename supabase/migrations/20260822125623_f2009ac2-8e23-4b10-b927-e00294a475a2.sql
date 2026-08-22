INSERT INTO public.app_settings (setting_key, setting_value, description) VALUES (
  'offer_approval_thresholds',
  '{"discount_percentage": 15, "amount": 30000}'::jsonb,
  'Soglie oltre le quali una versione di offerta richiede approvazione admin prima di passare da bozza a inviata: sconto effettivo (list_total, offered_total, MAI gli sconti di riga) in punti percentuali, e importo offerto in euro. Basta superarne una delle due. Valori di partenza, non un vincolo di prodotto: modificabili qui senza migration. Lette da public.get_offer_approval_thresholds().'
) ON CONFLICT (setting_key) DO NOTHING;
CREATE OR REPLACE FUNCTION public.get_offer_approval_thresholds()
RETURNS TABLE(discount_threshold_percentage numeric, amount_threshold numeric)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    COALESCE((SELECT (setting_value->>'discount_percentage')::numeric FROM public.app_settings WHERE setting_key = 'offer_approval_thresholds'), 15),
    COALESCE((SELECT (setting_value->>'amount')::numeric FROM public.app_settings WHERE setting_key = 'offer_approval_thresholds'), 30000)
$$;
COMMENT ON FUNCTION public.get_offer_approval_thresholds() IS 'Soglie correnti di approvazione offerte, da app_settings (chiave offer_approval_thresholds). Valori di default hard-coded qui SOLO come rete di sicurezza se la riga in app_settings viene rimossa: la fonte di verità resta la tabella.';
REVOKE ALL ON FUNCTION public.get_offer_approval_thresholds() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_offer_approval_thresholds() TO authenticated, service_role;
CREATE OR REPLACE FUNCTION public.get_offer_version_effective_discount_percentage(_offer_version_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT CASE WHEN list_total > 0
           THEN round((list_total - offered_total) / list_total * 100, 4)
           ELSE 0
         END
  FROM public.offer_versions
  WHERE id = _offer_version_id
$$;
COMMENT ON FUNCTION public.get_offer_version_effective_discount_percentage(uuid) IS 'Sconto effettivo di una versione, in punti percentuali: (list_total - offered_total) / list_total. Deriva SEMPRE dai totali di versione, mai da offer_lines.discount_percentage.';
REVOKE ALL ON FUNCTION public.get_offer_version_effective_discount_percentage(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_offer_version_effective_discount_percentage(uuid) TO authenticated, service_role;
CREATE OR REPLACE FUNCTION public.offer_version_requires_approval(_offer_version_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  _discount_percentage numeric;
  _offered_total numeric;
  _threshold_percentage numeric;
  _threshold_amount numeric;
BEGIN
  SELECT public.get_offer_version_effective_discount_percentage(_offer_version_id), offered_total
    INTO _discount_percentage, _offered_total
  FROM public.offer_versions
  WHERE id = _offer_version_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Versione offerta % non trovata', _offer_version_id;
  END IF;
  SELECT discount_threshold_percentage, amount_threshold INTO _threshold_percentage, _threshold_amount
    FROM public.get_offer_approval_thresholds();
  RETURN _discount_percentage > _threshold_percentage OR _offered_total > _threshold_amount;
END;
$$;
COMMENT ON FUNCTION public.offer_version_requires_approval(uuid) IS 'true se lo sconto effettivo o l''importo offerto della versione superano le soglie correnti (public.get_offer_approval_thresholds).';
REVOKE ALL ON FUNCTION public.offer_version_requires_approval(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.offer_version_requires_approval(uuid) TO authenticated, service_role;
DO $$
DECLARE
  v_conname text;
  v_attnum smallint;
BEGIN
  SELECT attnum INTO v_attnum
  FROM pg_attribute
  WHERE attrelid = 'public.offer_events'::regclass AND attname = 'event_type';
  SELECT conname INTO v_conname
  FROM pg_constraint
  WHERE conrelid = 'public.offer_events'::regclass
    AND contype = 'c'
    AND conkey = ARRAY[v_attnum];
  IF v_conname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.offer_events DROP CONSTRAINT %I', v_conname);
  END IF;
END $$;
ALTER TABLE public.offer_events ADD CONSTRAINT offer_events_event_type_check CHECK (event_type IN (
  'creata', 'in_approvazione', 'inviata', 'vista', 'accettata', 'rifiutata',
  'scaduta', 'superata', 'sostituita', 'firmata', 'respinta'
));
COMMENT ON CONSTRAINT offer_events_event_type_check ON public.offer_events IS 'respinta = un admin respinge una richiesta di approvazione (in_approvazione -> bozza); distinto da rifiutata, che è il CLIENTE che rifiuta l''offerta ricevuta.';
CREATE OR REPLACE FUNCTION public.notify_user_if_enabled(
  _user_id uuid,
  _type text,
  _title text,
  _message text,
  _project_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _in_app_enabled boolean;
BEGIN
  IF _user_id IS NULL THEN
    RETURN;
  END IF;
  SELECT COALESCE(in_app_enabled, true) INTO _in_app_enabled
    FROM public.notification_preferences
   WHERE user_id = _user_id AND notification_type = _type;
  _in_app_enabled := COALESCE(_in_app_enabled, true);
  IF _in_app_enabled THEN
    INSERT INTO public.notifications (user_id, type, title, message, project_id, read)
    VALUES (_user_id, _type, _title, _message, _project_id, false);
  END IF;
END;
$$;
COMMENT ON FUNCTION public.notify_user_if_enabled(uuid, text, text, text, uuid) IS 'Inserisce una notifica per conto del sistema, rispettando notification_preferences.in_app_enabled. Deliberatamente NON concessa a authenticated.';
REVOKE ALL ON FUNCTION public.notify_user_if_enabled(uuid, text, text, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notify_user_if_enabled(uuid, text, text, text, uuid) TO service_role;
CREATE OR REPLACE FUNCTION public.notify_offer_approval_required(_offer_version_id uuid, _reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _composer_id uuid;
  _project_id uuid;
  _year integer;
  _number integer;
  _version_number integer;
  _client_name text;
  _offered_total numeric;
  _discount_percentage numeric;
  _title text;
  _message text;
  _admin RECORD;
BEGIN
  SELECT ov.created_by, o.project_id, o.year, o.number, ov.version_number, c.name, ov.offered_total,
         public.get_offer_version_effective_discount_percentage(ov.id)
    INTO _composer_id, _project_id, _year, _number, _version_number, _client_name, _offered_total, _discount_percentage
  FROM public.offer_versions ov
  JOIN public.offers o ON o.id = ov.offer_id
  JOIN public.clients c ON c.id = o.client_id
  WHERE ov.id = _offer_version_id;
  _title := format('Offerta %s/%s in attesa di approvazione', _year, _number);
  _message := format(
    'Offerta %s/%s (v%s) per %s: importo offerto %s €, sconto effettivo %s%%. %s',
    _year, _number, _version_number, _client_name, _offered_total, round(_discount_percentage, 2), coalesce(_reason, '')
  );
  FOR _admin IN
    SELECT ur.user_id
    FROM public.user_roles ur
    JOIN public.profiles p ON p.id = ur.user_id
    WHERE ur.role = 'admin'
      AND p.approved = true
      AND p.deleted_at IS NULL
      AND ur.user_id IS DISTINCT FROM auth.uid()
      AND ur.user_id IS DISTINCT FROM _composer_id
  LOOP
    PERFORM public.notify_user_if_enabled(_admin.user_id, 'offer_approval_required', _title, _message, _project_id);
  END LOOP;
END;
$$;
CREATE OR REPLACE FUNCTION public.notify_offer_approval_outcome(_offer_version_id uuid, _approved boolean, _reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _composer_id uuid;
  _project_id uuid;
  _year integer;
  _number integer;
  _version_number integer;
  _client_name text;
  _offered_total numeric;
  _discount_percentage numeric;
  _type text;
  _title text;
  _message text;
BEGIN
  SELECT ov.created_by, o.project_id, o.year, o.number, ov.version_number, c.name, ov.offered_total,
         public.get_offer_version_effective_discount_percentage(ov.id)
    INTO _composer_id, _project_id, _year, _number, _version_number, _client_name, _offered_total, _discount_percentage
  FROM public.offer_versions ov
  JOIN public.offers o ON o.id = ov.offer_id
  JOIN public.clients c ON c.id = o.client_id
  WHERE ov.id = _offer_version_id;
  IF _composer_id IS NULL THEN
    RETURN;
  END IF;
  IF _approved THEN
    _type := 'offer_approved';
    _title := format('Offerta %s/%s approvata', _year, _number);
    _message := format(
      'Offerta %s/%s (v%s) per %s: importo %s €, sconto %s%%. Approvata, pronta per l''invio.%s',
      _year, _number, _version_number, _client_name, _offered_total, round(_discount_percentage, 2),
      CASE WHEN _reason IS NOT NULL THEN format(' Nota: %s', _reason) ELSE '' END
    );
  ELSE
    _type := 'offer_rejected';
    _title := format('Offerta %s/%s respinta', _year, _number);
    _message := format(
      'Offerta %s/%s (v%s) per %s: importo %s €, sconto %s%%. Respinta. Motivo: %s',
      _year, _number, _version_number, _client_name, _offered_total, round(_discount_percentage, 2),
      coalesce(_reason, 'non specificato')
    );
  END IF;
  PERFORM public.notify_user_if_enabled(_composer_id, _type, _title, _message, _project_id);
END;
$$;
COMMENT ON FUNCTION public.notify_offer_approval_required(uuid, text) IS 'Notifica (tipo offer_approval_required) tutti gli admin approvati e non cancellati, escludendo chi ha composto la versione e chi ha eseguito la transizione.';
COMMENT ON FUNCTION public.notify_offer_approval_outcome(uuid, boolean, text) IS 'Notifica (tipo offer_approved o offer_rejected) chi ha composto la versione, con l''esito della decisione di approvazione.';
REVOKE ALL ON FUNCTION public.notify_offer_approval_required(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_offer_approval_outcome(uuid, boolean, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notify_offer_approval_required(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.notify_offer_approval_outcome(uuid, boolean, text) TO service_role;
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
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Errore nell''invio della notifica per la transizione di %: %', _offer_version_id, SQLERRM;
  END;
  RETURN _event;
END;
$$;
COMMENT ON FUNCTION public.set_offer_version_status(uuid, public.offer_status, text, public.offer_event_actor_type, uuid, text, inet, text) IS 'Unico varco per cambiare offer_versions.status: quadratura piano di pagamento, redirect in approvazione sopra soglia, controllo admin diverso dal compositore, notifiche.';
REVOKE ALL ON FUNCTION public.set_offer_version_status(
  uuid, public.offer_status, text, public.offer_event_actor_type, uuid, text, inet, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_offer_version_status(
  uuid, public.offer_status, text, public.offer_event_actor_type, uuid, text, inet, text
) TO authenticated, service_role;