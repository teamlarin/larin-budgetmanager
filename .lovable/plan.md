

## Integrazione Fatture in Cloud: Fornitori + Preventivi

### Stato attuale

L'integrazione fornitori e' **gia' implementata**: OAuth, webhook per sync create/update/delete dei fornitori, tabella `fic_oauth_tokens`, edge functions `fatture-in-cloud-oauth`, `fatture-in-cloud-webhook`, `fatture-in-cloud-register-webhook`, componente UI `FattureInCloudIntegration.tsx`. Tutto funzionante.

### Da implementare: Invio preventivi a Fatture in Cloud

Quando un preventivo viene approvato o su azione manuale, inviarlo come "quote" (preventivo) all'API FIC tramite `POST /c/{company_id}/issued_documents` con `type: "quote"`.

---

### 1. Migrazione DB: aggiungere campo `fic_document_id` alla tabella `quotes`

Aggiungere una colonna `fic_document_id` (integer, nullable) alla tabella `quotes` per tracciare il documento creato su FIC e un campo `fic_id` (integer, nullable) alla tabella `clients` per mappare i clienti con le entita' FIC.

### 2. Edge Function: `fatture-in-cloud-send-quote`

Nuova edge function che:
- Riceve `{ quoteId }` dal frontend
- Carica il preventivo con budget items, servizi, prodotti e dati cliente da Supabase
- Recupera il token OAuth da `fic_oauth_tokens` (con refresh se scaduto)
- Cerca/crea il cliente su FIC (`GET /c/{company_id}/entities/clients?q=...` oppure `POST` se non esiste), salvando il `fic_id` nel nostro DB
- Crea il documento con `POST /c/{company_id}/issued_documents` con `type: "quote"`, mappando:
  - `entity`: cliente FIC (con id, name, vat_number, etc.)
  - `items_list`: lista di prodotti e servizi dal preventivo (nome, descrizione, qty, prezzo netto, IVA)
  - `subject`: numero preventivo
- Salva il `fic_document_id` restituito nella tabella `quotes`
- Configurazione in `supabase/config.toml` con `verify_jwt = false`

### 3. UI: Pulsante "Invia a Fatture in Cloud" nella pagina QuoteDetail

In `src/pages/QuoteDetail.tsx`:
- Aggiungere un pulsante "Invia a FIC" accanto al download PDF (visibile solo se la connessione FIC e' attiva)
- Se il preventivo e' gia' stato inviato (`fic_document_id` presente), mostrare un badge "Gia' inviato" con opzione di reinvio
- Il click chiama la edge function `fatture-in-cloud-send-quote` via `supabase.functions.invoke()`
- Toast di conferma/errore

### 4. Verifica connessione FIC nel componente QuoteDetail

Query la connessione FIC per decidere se mostrare il pulsante. Riutilizzare la stessa logica di `check-connection` gia' presente nella edge function `fatture-in-cloud-oauth`.

---

### Mapping dati Preventivo → Documento FIC

```text
Preventivo (Lovable)          →  Documento FIC (type: "quote")
─────────────────────────────────────────────────────────────
quote_number                  →  subject / numeration
client (name, email, vat)     →  entity { id, name, ... }
services[] (name, gross_price, vat_rate)  →  items_list[]
products[] (activity_name, total_cost)    →  items_list[]
discount_percentage           →  global_cassa_amount (o sconto per riga)
```

### File coinvolti

- **Nuova migrazione SQL**: aggiunge `fic_document_id` a `quotes`, `fic_id` a `clients`
- **Nuova edge function**: `supabase/functions/fatture-in-cloud-send-quote/index.ts`
- **Modifica**: `supabase/config.toml` (aggiunta nuova function)
- **Modifica**: `src/pages/QuoteDetail.tsx` (pulsante invio FIC)

