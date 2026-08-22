CREATE TYPE public.product_nature AS ENUM ('una_tantum', 'ricorrente', 'a_giornate');
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS vat_rate numeric NOT NULL DEFAULT 22,
  ADD COLUMN IF NOT EXISTS fic_id integer,
  ADD COLUMN IF NOT EXISTS revenue_category text,
  ADD COLUMN IF NOT EXISTS product_nature public.product_nature;
ALTER TABLE public.products
  ADD CONSTRAINT products_fic_id_key UNIQUE (fic_id);
COMMENT ON COLUMN public.products.vat_rate IS 'Aliquota IVA percentuale del prodotto (default 22%, stesso significato di budget_items.vat_rate/services.vat_rate)';
COMMENT ON COLUMN public.products.fic_id IS 'ID del prodotto corrispondente in Fatture in Cloud, per sync';
COMMENT ON COLUMN public.products.revenue_category IS 'Categoria di ricavo per la reportistica commerciale (testo libero: es. RICAVI MARKETING, RICAVI TECH - SOFTWARE, RICAVI BRANDING, RICAVI TECH - WEB, RICAVI JARVIS, RICAVI CANONI TECH, RICAVI CANONI MARKETING). Non è un enum perché il piano dei conti può evolvere senza richiedere una migration.';
COMMENT ON COLUMN public.products.product_nature IS 'Natura del prodotto ai fini di offerta/fatturazione: una tantum, ricorrente (canone) o a giornate';
COMMENT ON COLUMN public.products.category IS 'NB: colonna preesistente, categoria merceologica libera scelta in UI (non va confusa con revenue_category, che è la categoria di ricavo contabile)';
CREATE TYPE public.offer_origin AS ENUM ('commercial', 'tender');
CREATE TYPE public.offer_status AS ENUM (
  'bozza',
  'in_approvazione',
  'inviata',
  'vista',
  'accettata',
  'rifiutata',
  'scaduta',
  'superata',
  'sostituita'
);
CREATE TYPE public.offer_event_actor_type AS ENUM ('user', 'client', 'system');
CREATE TABLE public.offers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  year integer NOT NULL,
  number integer NOT NULL,
  origin public.offer_origin NOT NULL DEFAULT 'commercial',
  current_version_id uuid,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT offers_year_number_key UNIQUE (year, number)
);
COMMENT ON TABLE public.offers IS 'Identità di un''offerta commerciale: cliente, progetto (opzionale), numerazione annuale, origine, puntatore alla versione corrente. Righe/totali/sconti/condizioni vivono su offer_versions.';
COMMENT ON COLUMN public.offers.client_id IS 'ON DELETE RESTRICT: un cliente con offerte storiche non è cancellabile (documento commerciale, non va perso in cascata)';
COMMENT ON COLUMN public.offers.number IS 'Progressivo assegnato alla creazione (vedi trigger offers_set_number). La garanzia di unicità reale è offers_year_number_key, non la sequenza in sé.';
COMMENT ON COLUMN public.offers.current_version_id IS 'FK a offer_versions aggiunta dopo la creazione della tabella (dipendenza circolare offers <-> offer_versions). Nullable perché alla creazione dell''offerta la prima versione non esiste ancora.';
CREATE SEQUENCE public.offer_number_seq;
CREATE OR REPLACE FUNCTION public.set_next_offer_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.year IS NULL THEN
    NEW.year := EXTRACT(year FROM now())::int;
  END IF;
  IF NEW.number IS NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext('offer_number_seq:' || NEW.year::text));
    IF NOT EXISTS (SELECT 1 FROM public.offers WHERE year = NEW.year) THEN
      PERFORM setval('public.offer_number_seq', 1, false);
    END IF;
    NEW.number := nextval('public.offer_number_seq');
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER offers_set_number
BEFORE INSERT ON public.offers
FOR EACH ROW EXECUTE FUNCTION public.set_next_offer_number();
CREATE TRIGGER update_offers_updated_at
BEFORE UPDATE ON public.offers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_offers_client_id ON public.offers(client_id);
CREATE INDEX idx_offers_project_id ON public.offers(project_id) WHERE project_id IS NOT NULL;
CREATE TABLE public.offer_versions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  offer_id uuid NOT NULL REFERENCES public.offers(id) ON DELETE CASCADE,
  version_number integer NOT NULL,
  status public.offer_status NOT NULL DEFAULT 'bozza',
  list_total numeric(12,2) NOT NULL DEFAULT 0 CHECK (list_total >= 0),
  offered_total numeric(12,2) NOT NULL DEFAULT 0 CHECK (offered_total >= 0),
  payment_terms text,
  valid_until date,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT offer_versions_offer_version_number_key UNIQUE (offer_id, version_number)
);
COMMENT ON TABLE public.offer_versions IS 'Contenuto versionato di un''offerta: stato, totali, condizioni. Le righe stanno su offer_lines.';
COMMENT ON COLUMN public.offer_versions.version_number IS 'Indice progressivo interno all''offerta (1, 2, 3...), assegnato dal trigger offer_versions_set_number. Le versioni NON consumano la numerazione dell''offerta (offers.number).';
COMMENT ON COLUMN public.offer_versions.list_total IS 'Totale a valore di listino (somma righe a prezzo pieno, senza sconti)';
COMMENT ON COLUMN public.offer_versions.offered_total IS 'Totale effettivamente offerto al cliente. Lo sconto effettivo è sempre calcolabile come (list_total - offered_total) anche quando le righe sono esposte al cliente a prezzo unico e i loro discount_percentage sono a zero.';
COMMENT ON COLUMN public.offer_versions.valid_until IS 'Data di validità dell''offerta: necessaria perché lo stato "scaduta" abbia un criterio oggettivo di applicazione (va gestito lato applicazione/cron, questa migration non aggiunge automatismi di scadenza)';
COMMENT ON COLUMN public.offer_versions.status IS 'Scrivibile SOLO tramite public.set_offer_version_status(): vedi trigger guard_offer_version_status e la REVOKE UPDATE(status) più sotto.';
ALTER TABLE public.offers
  ADD CONSTRAINT offers_current_version_id_fkey
  FOREIGN KEY (current_version_id) REFERENCES public.offer_versions(id) ON DELETE SET NULL;
CREATE OR REPLACE FUNCTION public.set_next_offer_version_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.version_number IS NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext('offer_version_seq:' || NEW.offer_id::text));
    SELECT COALESCE(MAX(version_number), 0) + 1
      INTO NEW.version_number
      FROM public.offer_versions
      WHERE offer_id = NEW.offer_id;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER offer_versions_set_number
BEFORE INSERT ON public.offer_versions
FOR EACH ROW EXECUTE FUNCTION public.set_next_offer_version_number();
CREATE TRIGGER update_offer_versions_updated_at
BEFORE UPDATE ON public.offer_versions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_offer_versions_offer_id ON public.offer_versions(offer_id);
CREATE INDEX idx_offer_versions_status ON public.offer_versions(status);
CREATE OR REPLACE FUNCTION public.guard_offer_version_status_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF current_setting('app.offer_status_transition_allowed', true) IS DISTINCT FROM 'on' THEN
      RAISE EXCEPTION 'offer_versions.status si aggiorna solo tramite public.set_offer_version_status(), per garantire che ogni transizione sia registrata in offer_events';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER guard_offer_version_status
BEFORE UPDATE ON public.offer_versions
FOR EACH ROW EXECUTE FUNCTION public.guard_offer_version_status_update();
CREATE TABLE public.offer_lines (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  offer_version_id uuid NOT NULL REFERENCES public.offer_versions(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  description text NOT NULL,
  revenue_category text,
  quantity numeric(12,2) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_list_price numeric(12,2) NOT NULL CHECK (unit_list_price >= 0),
  discount_percentage numeric NOT NULL DEFAULT 0 CHECK (discount_percentage >= 0 AND discount_percentage <= 100),
  vat_rate numeric NOT NULL DEFAULT 22,
  line_total numeric(12,2) NOT NULL DEFAULT 0 CHECK (line_total >= 0),
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.offer_lines IS 'Righe di una versione di offerta. Prezzo/aliquota/categoria sono uno snapshot da products al momento della creazione della riga, non un live join.';
COMMENT ON COLUMN public.offer_lines.product_id IS 'Riferimento al prodotto di catalogo per reportistica; ON DELETE SET NULL perché la riga ha già il proprio snapshot e sopravvive alla cancellazione del prodotto';
COMMENT ON COLUMN public.offer_lines.discount_percentage IS 'Sconto di riga; può restare a 0 quando lo sconto si applica solo a livello di versione (prezzo unico esposto al cliente), lo sconto effettivo si ricava comunque da offer_versions (list_total - offered_total)';
CREATE TRIGGER update_offer_lines_updated_at
BEFORE UPDATE ON public.offer_lines
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_offer_lines_offer_version_id ON public.offer_lines(offer_version_id);
CREATE INDEX idx_offer_lines_product_id ON public.offer_lines(product_id) WHERE product_id IS NOT NULL;
CREATE TABLE public.offer_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  offer_version_id uuid NOT NULL REFERENCES public.offer_versions(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN (
    'creata', 'in_approvazione', 'inviata', 'vista', 'accettata', 'rifiutata',
    'scaduta', 'superata', 'sostituita', 'firmata'
  )),
  previous_status public.offer_status,
  new_status public.offer_status,
  actor_type public.offer_event_actor_type NOT NULL,
  actor_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  client_token text,
  client_ip inet,
  note text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT offer_events_actor_shape_check CHECK (
    (actor_type = 'user' AND actor_user_id IS NOT NULL AND client_token IS NULL AND client_ip IS NULL)
    OR (actor_type = 'client' AND actor_user_id IS NULL AND client_token IS NOT NULL AND client_ip IS NOT NULL)
    OR (actor_type = 'system' AND actor_user_id IS NULL AND client_token IS NULL)
  )
);
COMMENT ON TABLE public.offer_events IS 'Registro append-only delle transizioni di offer_versions. Nessuna policy di UPDATE/DELETE; a authenticated non è concesso nemmeno INSERT diretto (privilegio non garantito) - si scrive solo tramite public.set_offer_version_status(), SECURITY DEFINER.';
COMMENT ON COLUMN public.offer_events.actor_type IS 'user = staff Larin autenticato (FK a profiles); client = chi accetta/vede/firma senza account, identificato da token+IP; system = automatismi (es. scadenza)';
COMMENT ON CONSTRAINT offer_events_actor_shape_check ON public.offer_events IS 'Solo per actor_type=''user'' esiste una FK a un account; per ''client'' si registrano token e IP invece di un utente, perché le transizioni vista/accettata/firmata sono compiute da un cliente senza account';
CREATE INDEX idx_offer_events_offer_version_id ON public.offer_events(offer_version_id);
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
CREATE OR REPLACE FUNCTION public.can_manage_offer(_offer_id uuid)
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
    OR EXISTS (SELECT 1 FROM public.offers o WHERE o.id = _offer_id AND o.created_by = auth.uid())
  )
$$;
CREATE OR REPLACE FUNCTION public.can_manage_offer_version(_offer_version_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.offer_versions v
    WHERE v.id = _offer_version_id AND public.can_manage_offer(v.offer_id)
  )
$$;
REVOKE EXECUTE ON FUNCTION public.can_manage_offer(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_manage_offer_version(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_offer(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_manage_offer_version(uuid) TO authenticated, service_role;
ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, DELETE ON public.offers TO authenticated;
GRANT ALL ON public.offers TO service_role;
GRANT UPDATE (project_id, origin, current_version_id) ON public.offers TO authenticated;
CREATE POLICY "Approved users can view offers"
ON public.offers FOR SELECT
TO authenticated
USING (public.is_approved_user(auth.uid()));
CREATE POLICY "Commercial roles or creator can create offers"
ON public.offers FOR INSERT
TO authenticated
WITH CHECK (
  public.is_approved_user(auth.uid())
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'account')
    OR public.has_role(auth.uid(), 'finance')
    OR created_by = auth.uid()
  )
);
CREATE POLICY "Commercial roles or creator can update offers"
ON public.offers FOR UPDATE
TO authenticated
USING (public.can_manage_offer(id))
WITH CHECK (public.can_manage_offer(id));
CREATE POLICY "Commercial roles or creator can delete draft-only offers"
ON public.offers FOR DELETE
TO authenticated
USING (
  public.can_manage_offer(id)
  AND NOT EXISTS (
    SELECT 1 FROM public.offer_versions v
    WHERE v.offer_id = offers.id AND v.status <> 'bozza'
  )
);
ALTER TABLE public.offer_versions ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, DELETE ON public.offer_versions TO authenticated;
GRANT ALL ON public.offer_versions TO service_role;
GRANT UPDATE (list_total, offered_total, payment_terms, valid_until) ON public.offer_versions TO authenticated;
CREATE POLICY "Approved users can view offer versions"
ON public.offer_versions FOR SELECT
TO authenticated
USING (public.is_approved_user(auth.uid()));
CREATE POLICY "Offer managers can create versions"
ON public.offer_versions FOR INSERT
TO authenticated
WITH CHECK (public.can_manage_offer(offer_id));
CREATE POLICY "Offer managers can update versions"
ON public.offer_versions FOR UPDATE
TO authenticated
USING (public.can_manage_offer(offer_id))
WITH CHECK (public.can_manage_offer(offer_id));
CREATE POLICY "Offer managers can delete draft versions"
ON public.offer_versions FOR DELETE
TO authenticated
USING (public.can_manage_offer(offer_id) AND status = 'bozza');
ALTER TABLE public.offer_lines ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.offer_lines TO authenticated;
GRANT ALL ON public.offer_lines TO service_role;
CREATE POLICY "Approved users can view offer lines"
ON public.offer_lines FOR SELECT
TO authenticated
USING (public.is_approved_user(auth.uid()));
CREATE POLICY "Offer managers can create lines"
ON public.offer_lines FOR INSERT
TO authenticated
WITH CHECK (public.can_manage_offer_version(offer_version_id));
CREATE POLICY "Offer managers can update lines"
ON public.offer_lines FOR UPDATE
TO authenticated
USING (public.can_manage_offer_version(offer_version_id))
WITH CHECK (public.can_manage_offer_version(offer_version_id));
CREATE POLICY "Offer managers can delete lines"
ON public.offer_lines FOR DELETE
TO authenticated
USING (public.can_manage_offer_version(offer_version_id));
ALTER TABLE public.offer_events ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.offer_events TO authenticated;
GRANT ALL ON public.offer_events TO service_role;
CREATE POLICY "Approved users can view offer events"
ON public.offer_events FOR SELECT
TO authenticated
USING (public.is_approved_user(auth.uid()));