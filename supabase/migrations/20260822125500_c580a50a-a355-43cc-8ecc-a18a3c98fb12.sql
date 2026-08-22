create or replace function public.guard_offer_version_status_update()
returns trigger
language plpgsql
set search_path = public
as $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF current_setting('app.offer_status_transition_allowed', true) IS DISTINCT FROM 'on' THEN
      RAISE EXCEPTION 'offer_versions.status si aggiorna solo tramite public.set_offer_version_status(), per garantire che ogni transizione sia registrata in offer_events';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
create or replace function public.guard_offer_version_content_immutable()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    if old.status <> 'bozza' then
      raise exception 'Non si elimina una versione già uscita (stato %): crearne una nuova.', old.status
        using errcode = 'check_violation';
    end if;
    return old;
  end if;
  if old.status = 'bozza' then
    return new;
  end if;
  if new.list_total     is distinct from old.list_total
     or new.offered_total is distinct from old.offered_total
     or new.payment_terms is distinct from old.payment_terms
     or new.valid_until   is distinct from old.valid_until
     or new.offer_id      is distinct from old.offer_id
     or new.version_number is distinct from old.version_number then
    raise exception 'Il contenuto di una versione già uscita (stato %) non è modificabile: crearne una nuova.', old.status
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_offer_versions_content_immutable on public.offer_versions;
create trigger trg_offer_versions_content_immutable
  before update or delete on public.offer_versions
  for each row execute function public.guard_offer_version_content_immutable();
create or replace function public.guard_offer_lines_immutable()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_status public.offer_status;
  v_version_id uuid;
begin
  v_version_id := coalesce(new.offer_version_id, old.offer_version_id);
  select status into v_status from public.offer_versions where id = v_version_id;
  if v_status is null then
    return coalesce(new, old);
  end if;
  if v_status <> 'bozza' then
    raise exception 'Le righe di una versione già uscita (stato %) non sono modificabili: crearne una nuova.', v_status
      using errcode = 'check_violation';
  end if;
  return coalesce(new, old);
end;
$$;
drop trigger if exists trg_offer_lines_immutable on public.offer_lines;
create trigger trg_offer_lines_immutable
  before insert or update or delete on public.offer_lines
  for each row execute function public.guard_offer_lines_immutable();
comment on function public.guard_offer_version_content_immutable() is
  'Impedisce di alterare il contenuto di una versione non più in bozza: dopo l''invio si crea una versione nuova.';
comment on function public.guard_offer_lines_immutable() is
  'Stessa regola sulle righe: nessun inserimento, modifica o eliminazione su una versione già uscita.';

CREATE TYPE public.payment_term_due_basis AS ENUM ('data_documento', 'fine_mese');
ALTER TABLE public.payment_terms
  ADD COLUMN IF NOT EXISTS days integer,
  ADD COLUMN IF NOT EXISTS due_basis public.payment_term_due_basis;
ALTER TABLE public.payment_terms
  ADD CONSTRAINT payment_terms_days_check CHECK (days IS NULL OR days >= 0),
  ADD CONSTRAINT payment_terms_days_due_basis_check CHECK (
    (days IS NULL AND due_basis IS NULL) OR (days IS NOT NULL AND due_basis IS NOT NULL)
  );
COMMENT ON COLUMN public.payment_terms.days IS 'Giorni di dilazione dalla base di calcolo indicata da due_basis. NULL sui termini storici che restano etichette pure: non selezionabili su una tranche di offer_payment_terms (vedi guard_offer_payment_term_selectable).';
COMMENT ON COLUMN public.payment_terms.due_basis IS 'Base di calcolo della scadenza: data_documento = data del documento + days; fine_mese = fine mese del documento + days (es. "60gg FM" = fine mese + 60 giorni). Nullo se e solo se days è nullo (payment_terms_days_due_basis_check).';
UPDATE public.payment_terms SET days = 30, due_basis = 'data_documento' WHERE value = '30gg DF' AND days IS NULL;
UPDATE public.payment_terms SET days = 60, due_basis = 'data_documento' WHERE value = '60gg DF' AND days IS NULL;
UPDATE public.payment_terms SET days = 90, due_basis = 'data_documento' WHERE value = '90gg DF' AND days IS NULL;
UPDATE public.payment_terms SET days = 30, due_basis = 'fine_mese'     WHERE value = '30gg FM' AND days IS NULL;
UPDATE public.payment_terms SET days = 60, due_basis = 'fine_mese'     WHERE value = '60gg FM' AND days IS NULL;
UPDATE public.payment_terms SET days = 90, due_basis = 'fine_mese'     WHERE value = '90gg FM' AND days IS NULL;
CREATE OR REPLACE FUNCTION public.compute_payment_term_due_date(_payment_term_id uuid, _document_date date)
RETURNS date
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_days integer;
  v_due_basis public.payment_term_due_basis;
  v_base date;
BEGIN
  SELECT days, due_basis INTO v_days, v_due_basis
    FROM public.payment_terms
   WHERE id = _payment_term_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Termine di pagamento % non trovato', _payment_term_id;
  END IF;
  IF v_days IS NULL THEN
    RAISE EXCEPTION 'Il termine di pagamento % è solo un''etichetta storica (giorni non impostati): non può calcolare una scadenza', _payment_term_id;
  END IF;
  IF v_due_basis = 'fine_mese' THEN
    v_base := (date_trunc('month', _document_date) + interval '1 month - 1 day')::date;
  ELSE
    v_base := _document_date;
  END IF;
  RETURN v_base + v_days;
END;
$$;
COMMENT ON FUNCTION public.compute_payment_term_due_date(uuid, date) IS 'Calcola la data di scadenza di un termine di pagamento a partire dalla data del documento (fattura o altro). Solleva eccezione sui termini storici senza days/due_basis.';
REVOKE ALL ON FUNCTION public.compute_payment_term_due_date(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.compute_payment_term_due_date(uuid, date) TO authenticated, service_role;
CREATE TYPE public.offer_billing_mode AS ENUM ('importo_finito', 'ricorrente', 'a_giornate', 'tetto_di_spesa');
ALTER TABLE public.offer_versions
  ADD COLUMN IF NOT EXISTS billing_mode public.offer_billing_mode NOT NULL DEFAULT 'importo_finito';
COMMENT ON COLUMN public.offer_versions.billing_mode IS 'Modo di fatturazione dell''offerta: importo_finito (il caso più comune, il piano quadra sul totale offerto), ricorrente/a_giornate/tetto_di_spesa (quadrano per periodo o consumo, non su un totale fisso: vedi validate_offer_payment_terms_balance).';
create or replace function public.guard_offer_version_content_immutable()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    if old.status <> 'bozza' then
      raise exception 'Non si elimina una versione già uscita (stato %): crearne una nuova.', old.status
        using errcode = 'check_violation';
    end if;
    return old;
  end if;
  if old.status = 'bozza' then
    return new;
  end if;
  if new.list_total     is distinct from old.list_total
     or new.offered_total is distinct from old.offered_total
     or new.payment_terms is distinct from old.payment_terms
     or new.valid_until   is distinct from old.valid_until
     or new.billing_mode  is distinct from old.billing_mode
     or new.offer_id      is distinct from old.offer_id
     or new.version_number is distinct from old.version_number then
    raise exception 'Il contenuto di una versione già uscita (stato %) non è modificabile: crearne una nuova.', old.status
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
GRANT UPDATE (billing_mode) ON public.offer_versions TO authenticated;
CREATE TYPE public.offer_payment_term_maturity_event AS ENUM (
  'firma', 'consegna', 'pubblicazione_fase', 'data_calendario', 'ricorrente'
);
CREATE TYPE public.offer_payment_term_maturity_status AS ENUM ('da_maturare', 'maturata');
CREATE TABLE public.offer_payment_terms (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  offer_version_id uuid NOT NULL REFERENCES public.offer_versions(id) ON DELETE CASCADE,
  amount numeric(12,2) CHECK (amount > 0),
  percentage numeric CHECK (percentage > 0 AND percentage <= 100),
  payment_term_id uuid NOT NULL REFERENCES public.payment_terms(id) ON DELETE RESTRICT,
  maturity_event public.offer_payment_term_maturity_event NOT NULL,
  scheduled_date date,
  phase_label text,
  display_order integer NOT NULL DEFAULT 0,
  maturity_status public.offer_payment_term_maturity_status NOT NULL DEFAULT 'da_maturare',
  matured_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT offer_payment_terms_amount_xor_percentage_check CHECK (
    (amount IS NOT NULL AND percentage IS NULL) OR (amount IS NULL AND percentage IS NOT NULL)
  ),
  CONSTRAINT offer_payment_terms_scheduled_date_check CHECK (
    (maturity_event = 'data_calendario') = (scheduled_date IS NOT NULL)
  ),
  CONSTRAINT offer_payment_terms_phase_label_check CHECK (
    (maturity_event = 'pubblicazione_fase') = (phase_label IS NOT NULL)
  )
);
COMMENT ON TABLE public.offer_payment_terms IS 'Tranche del piano di pagamento di una versione di offerta. Importo o percentuale (mai entrambi), termine di pagamento per calcolare la scadenza, evento che fa maturare la tranche, stato di maturazione.';
COMMENT ON COLUMN public.offer_payment_terms.amount IS 'Importo fisso della tranche; esclusivo con percentage (offer_payment_terms_amount_xor_percentage_check)';
COMMENT ON COLUMN public.offer_payment_terms.percentage IS 'Percentuale della tranche sul totale offerto della versione; esclusiva con amount. Su offerte a importo finito concorre alla quadratura (vedi validate_offer_payment_terms_balance)';
COMMENT ON COLUMN public.offer_payment_terms.payment_term_id IS 'FK a payment_terms per calcolare la scadenza (giorni + decorrenza). Deve avere days valorizzato: vedi guard_offer_payment_term_selectable';
COMMENT ON COLUMN public.offer_payment_terms.maturity_event IS 'Evento che fa maturare la tranche: firma, consegna, pubblicazione di una fase, una data di calendario, oppure ricorrente (periodica). Non aggiunge automatismi di generazione delle occorrenze ricorrenti: resta un tag, la schedulazione concreta è demandata all''applicazione.';
COMMENT ON COLUMN public.offer_payment_terms.scheduled_date IS 'Data di calendario a cui la tranche matura; valorizzata solo quando maturity_event = data_calendario';
COMMENT ON COLUMN public.offer_payment_terms.phase_label IS 'Etichetta libera della fase il cui rilascio fa maturare la tranche; valorizzata solo quando maturity_event = pubblicazione_fase (non esiste ancora un''entità "fase" in schema)';
COMMENT ON COLUMN public.offer_payment_terms.maturity_status IS 'Scrivibile SOLO tramite public.mark_offer_payment_term_matured(): vedi trigger guard_offer_payment_term_maturity e il GRANT UPDATE per colonne più sotto.';
COMMENT ON COLUMN public.offer_payment_terms.matured_at IS 'Timestamp in cui la tranche è maturata, impostato da public.mark_offer_payment_term_matured(). Nessun automatismo di sistema la valorizza da sola (es. il passaggio di scheduled_date non matura la tranche in automatico: va gestito lato applicazione/cron, come già per offer_versions.valid_until).';
CREATE TRIGGER update_offer_payment_terms_updated_at
BEFORE UPDATE ON public.offer_payment_terms
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_offer_payment_terms_offer_version_id ON public.offer_payment_terms(offer_version_id);
CREATE INDEX idx_offer_payment_terms_payment_term_id ON public.offer_payment_terms(payment_term_id);
CREATE OR REPLACE FUNCTION public.guard_offer_payment_term_selectable()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_days integer;
BEGIN
  SELECT days INTO v_days FROM public.payment_terms WHERE id = new.payment_term_id;
  IF v_days IS NULL THEN
    RAISE EXCEPTION 'Il termine di pagamento selezionato non ha i giorni di dilazione impostati: non è utilizzabile su una tranche di offerta (è solo un''etichetta storica)'
      USING errcode = 'check_violation';
  END IF;
  RETURN new;
END;
$$;
CREATE TRIGGER trg_offer_payment_terms_selectable
BEFORE INSERT OR UPDATE OF payment_term_id ON public.offer_payment_terms
FOR EACH ROW EXECUTE FUNCTION public.guard_offer_payment_term_selectable();
CREATE OR REPLACE FUNCTION public.guard_offer_payment_term_maturity_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF tg_op = 'INSERT' THEN
    IF (new.maturity_status IS DISTINCT FROM 'da_maturare' OR new.matured_at IS NOT NULL)
       AND current_setting('app.offer_payment_term_maturity_transition_allowed', true) IS DISTINCT FROM 'on' THEN
      RAISE EXCEPTION 'Una tranche nuova nasce sempre da_maturare: la maturazione si registra solo tramite public.mark_offer_payment_term_matured()';
    END IF;
    RETURN new;
  END IF;
  IF new.maturity_status IS DISTINCT FROM old.maturity_status
     OR new.matured_at IS DISTINCT FROM old.matured_at THEN
    IF current_setting('app.offer_payment_term_maturity_transition_allowed', true) IS DISTINCT FROM 'on' THEN
      RAISE EXCEPTION 'offer_payment_terms.maturity_status/matured_at si aggiornano solo tramite public.mark_offer_payment_term_matured()';
    END IF;
  END IF;
  RETURN new;
END;
$$;
CREATE TRIGGER guard_offer_payment_term_maturity
BEFORE INSERT OR UPDATE ON public.offer_payment_terms
FOR EACH ROW EXECUTE FUNCTION public.guard_offer_payment_term_maturity_update();
CREATE OR REPLACE FUNCTION public.mark_offer_payment_term_matured(
  _offer_payment_term_id uuid,
  _matured_at timestamptz DEFAULT now()
)
RETURNS public.offer_payment_terms
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _offer_version_id uuid;
  _row public.offer_payment_terms;
BEGIN
  SELECT offer_version_id INTO _offer_version_id
    FROM public.offer_payment_terms
   WHERE id = _offer_payment_term_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tranche % non trovata', _offer_payment_term_id;
  END IF;
  IF NOT public.can_manage_offer_version(_offer_version_id) THEN
    RAISE EXCEPTION 'Non autorizzato a registrare la maturazione di questa tranche';
  END IF;
  PERFORM set_config('app.offer_payment_term_maturity_transition_allowed', 'on', true);
  UPDATE public.offer_payment_terms
     SET maturity_status = 'maturata',
         matured_at = COALESCE(_matured_at, now())
   WHERE id = _offer_payment_term_id
  RETURNING * INTO _row;
  PERFORM set_config('app.offer_payment_term_maturity_transition_allowed', 'off', true);
  RETURN _row;
END;
$$;
COMMENT ON FUNCTION public.mark_offer_payment_term_matured(uuid, timestamptz) IS 'Unico varco per marcare una tranche come maturata (nessun revert: non richiesto). Non genera automatismi per data_calendario/ricorrente: la valutazione "è arrivata la data" resta a carico dell''applicazione/cron, questa funzione registra solo il fatto compiuto.';
REVOKE ALL ON FUNCTION public.mark_offer_payment_term_matured(uuid, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_offer_payment_term_matured(uuid, timestamptz) TO authenticated, service_role;
CREATE OR REPLACE FUNCTION public.guard_offer_payment_terms_immutable()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_status public.offer_status;
  v_version_id uuid;
BEGIN
  v_version_id := coalesce(new.offer_version_id, old.offer_version_id);
  SELECT status INTO v_status FROM public.offer_versions WHERE id = v_version_id;
  IF v_status IS NULL THEN
    RETURN coalesce(new, old);
  END IF;
  IF v_status = 'bozza' THEN
    RETURN coalesce(new, old);
  END IF;
  IF tg_op = 'DELETE' THEN
    RAISE EXCEPTION 'Le tranche di una versione già uscita (stato %) non sono eliminabili: crearne una nuova.', v_status
      USING errcode = 'check_violation';
  END IF;
  IF tg_op = 'INSERT' THEN
    RAISE EXCEPTION 'Non si aggiungono tranche a una versione già uscita (stato %): crearne una nuova.', v_status
      USING errcode = 'check_violation';
  END IF;
  IF new.amount IS DISTINCT FROM old.amount
     OR new.percentage IS DISTINCT FROM old.percentage
     OR new.payment_term_id IS DISTINCT FROM old.payment_term_id
     OR new.maturity_event IS DISTINCT FROM old.maturity_event
     OR new.scheduled_date IS DISTINCT FROM old.scheduled_date
     OR new.phase_label IS DISTINCT FROM old.phase_label
     OR new.display_order IS DISTINCT FROM old.display_order
     OR new.offer_version_id IS DISTINCT FROM old.offer_version_id THEN
    RAISE EXCEPTION 'Il contenuto di una tranche su una versione già uscita (stato %) non è modificabile: crearne una nuova versione. Solo lo stato di maturazione può ancora evolvere.', v_status
      USING errcode = 'check_violation';
  END IF;
  RETURN new;
END;
$$;
CREATE TRIGGER trg_offer_payment_terms_immutable
BEFORE INSERT OR UPDATE OR DELETE ON public.offer_payment_terms
FOR EACH ROW EXECUTE FUNCTION public.guard_offer_payment_terms_immutable();
CREATE OR REPLACE FUNCTION public.validate_offer_payment_terms_balance(_offer_version_id uuid)
RETURNS void
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_billing_mode public.offer_billing_mode;
  v_offered_total numeric(12,2);
  v_count integer;
  v_sum numeric;
  v_tolerance numeric;
BEGIN
  SELECT billing_mode, offered_total INTO v_billing_mode, v_offered_total
    FROM public.offer_versions
   WHERE id = _offer_version_id;
  IF v_billing_mode IS DISTINCT FROM 'importo_finito' THEN
    RETURN;
  END IF;
  SELECT count(*), coalesce(sum(coalesce(amount, round(v_offered_total * percentage / 100, 2))), 0)
    INTO v_count, v_sum
    FROM public.offer_payment_terms
   WHERE offer_version_id = _offer_version_id;
  IF v_count = 0 THEN
    RETURN;
  END IF;
  v_tolerance := round(v_offered_total * (v_count * 0.01) / 100, 2);
  IF abs(v_sum - v_offered_total) > v_tolerance THEN
    RAISE EXCEPTION 'Le tranche di pagamento (%) non quadrano con il totale offerto (%): differenza % oltre la tolleranza di % (0,01 punti percentuali per tranche, % tranche)',
      v_sum, v_offered_total, abs(v_sum - v_offered_total), v_tolerance, v_count;
  END IF;
END;
$$;
COMMENT ON FUNCTION public.validate_offer_payment_terms_balance(uuid) IS 'Verifica che le tranche quadrino col totale offerto, solo per billing_mode = importo_finito. Invocata da public.set_offer_version_status() alla prima uscita dalla bozza.';
REVOKE ALL ON FUNCTION public.validate_offer_payment_terms_balance(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.validate_offer_payment_terms_balance(uuid) TO authenticated, service_role;
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
  SELECT status INTO _old_status
    FROM public.offer_versions
   WHERE id = _offer_version_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Versione offerta % non trovata', _offer_version_id;
  END IF;
  IF _old_status = 'bozza' AND _new_status <> 'bozza' THEN
    PERFORM public.validate_offer_payment_terms_balance(_offer_version_id);
  END IF;
  PERFORM set_config('app.offer_status_transition_allowed', 'on', true);
  UPDATE public.offer_versions
     SET status = _new_status
   WHERE id = _offer_version_id;
  PERFORM set_config('app.offer_status_transition_allowed', 'off', true);
  INSERT INTO public.offer_events (
    offer_version_id, event_type, previous_status, new_status,
    actor_type, actor_user_id, client_token, client_ip, note
  ) VALUES (
    _offer_version_id, _event_type, _old_status, _new_status,
    _actor_type, _actor_user_id, _client_token, _client_ip, _note
  )
  RETURNING * INTO _event;
  RETURN _event;
END;
$$;
REVOKE ALL ON FUNCTION public.set_offer_version_status(
  uuid, public.offer_status, text, public.offer_event_actor_type, uuid, text, inet, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_offer_version_status(
  uuid, public.offer_status, text, public.offer_event_actor_type, uuid, text, inet, text
) TO authenticated, service_role;
ALTER TABLE public.offer_payment_terms ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, DELETE ON public.offer_payment_terms TO authenticated;
GRANT ALL ON public.offer_payment_terms TO service_role;
GRANT UPDATE (amount, percentage, payment_term_id, maturity_event, scheduled_date, phase_label, display_order)
  ON public.offer_payment_terms TO authenticated;
CREATE POLICY "Approved users can view offer payment terms"
ON public.offer_payment_terms FOR SELECT
TO authenticated
USING (public.is_approved_user(auth.uid()));
CREATE POLICY "Offer managers can create payment terms"
ON public.offer_payment_terms FOR INSERT
TO authenticated
WITH CHECK (public.can_manage_offer_version(offer_version_id));
CREATE POLICY "Offer managers can update payment terms"
ON public.offer_payment_terms FOR UPDATE
TO authenticated
USING (public.can_manage_offer_version(offer_version_id))
WITH CHECK (public.can_manage_offer_version(offer_version_id));
CREATE POLICY "Offer managers can delete payment terms"
ON public.offer_payment_terms FOR DELETE
TO authenticated
USING (public.can_manage_offer_version(offer_version_id));