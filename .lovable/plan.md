
# API pubbliche Timetrap — Progetti (v1, read-only)

Espone endpoint REST stabili per leggere i progetti da strumenti esterni (knowledge base aziendale, automazioni). Autenticazione tramite **API key statiche** generate dall'admin nelle Impostazioni.

## 1. Database — tabella `api_keys`

Nuova tabella per gestire le chiavi:

- `name` (es. "Notion KB", "Make automation")
- `key_prefix` (8 char, visibile per identificare la chiave nell'UI)
- `key_hash` (SHA-256 della chiave completa, mai salvata in chiaro)
- `scopes` (array di stringhe, v1: solo `projects:read`)
- `created_by`, `last_used_at`, `revoked_at`, `expires_at` (nullable)

**RLS**: solo admin possono SELECT / INSERT / UPDATE / DELETE. La verifica della chiave avviene server-side nell'edge function con service role.

## 2. Edge function `public-api`

Funzione singola con routing interno (`verify_jwt = false`), endpoint:

- `GET /projects` — lista paginata con filtri
  - query: `status`, `project_status`, `area`, `client_id`, `updated_since`, `limit` (default 50, max 200), `cursor`
  - risposta: `{ data: [...], next_cursor, total }`
- `GET /projects/:id` — dettaglio singolo progetto
- `GET /health` — ping (no auth) per testare la connettività

**Autenticazione**: header `Authorization: Bearer <api_key>` oppure `X-Api-Key`. La function:
1. Estrae la chiave, calcola SHA-256, cerca match attivo (non revocato, non scaduto) in `api_keys`
2. Aggiorna `last_used_at`
3. Verifica lo scope `projects:read`
4. In caso di errore: 401 con `{ error, code }`

**Rate limiting**: in-memory token bucket per `key_hash` (es. 60 req/min) con warning che non è persistente.

**Logging**: registra ogni richiesta in una tabella `api_request_logs` (key_id, endpoint, status, latency_ms, ip) per audit. Retention 30gg via cron esistente o pulizia manuale.

## 3. Payload `Project` (versionato, stabile)

Solo campi pubblici/utili, niente cost data sensibili. Esempio:

```json
{
  "id": "uuid",
  "name": "...",
  "description": "...",
  "status": "approvato",
  "project_status": "aperto",
  "area": "tech",
  "discipline": "...",
  "start_date": "2026-01-15",
  "end_date": "2026-03-30",
  "progress": 45,
  "quote_number": "Q-2026-018",
  "client": { "id": "...", "name": "..." },
  "account": { "id": "...", "name": "..." },
  "project_leader": { "id": "...", "name": "..." },
  "drive_folder_url": "...",
  "created_at": "...",
  "updated_at": "..."
}
```

Esplicitamente **esclusi** in v1: `total_budget`, `margin_percentage`, `discount_percentage`, dati finanziari. Possono essere aggiunti dietro scope dedicato (`projects:read:financials`) in futuro.

## 4. UI — Impostazioni → API Keys

Nuovo tab nella pagina Settings (visibile solo admin):

- Pulsante "Genera nuova API key" → dialog con nome + scope (preselezionato `projects:read`)
- Alla creazione: mostra **una sola volta** la chiave completa in chiaro con pulsante copia + warning "non potrai vederla di nuovo"
- Tabella elenco: nome, prefix (`tt_live_a1b2c3…`), creata il, ultimo uso, stato (attiva/revocata), azione "Revoca"
- Link a documentazione inline (sezione below) con esempi `curl`

## 5. Documentazione

Aggiunta nuova sezione in `src/components/docs/` ("API Reference") con:
- Base URL: `https://dmwyqyqaseyuybqfawvk.supabase.co/functions/v1/public-api`
- Auth header + esempi curl
- Tabella endpoint, parametri, risposta
- Codici errore (401, 403, 404, 429, 500)
- Note di versioning (URL versionato `/v1/...` quando uscirà v2)

## Dettagli tecnici

- **Formato chiave**: `tt_live_` + 32 char random base62 (es. `tt_live_a1b2c3...`). Prefix `tt_live_` permette future varianti (`tt_test_`).
- **Hashing**: SHA-256 via WebCrypto (`crypto.subtle.digest`), no salt necessario perché la chiave ha >190 bit di entropia.
- **Paginazione**: cursor-based su `(updated_at, id)` per stabilità con dataset che cambia.
- **Naming function**: `public-api` (config.toml: `verify_jwt = false`).
- **CORS**: aperto (`*`) perché destinato a server-to-server; nessun cookie/credenziale.
- **Cosa NON faccio in v1**: scrittura, webhook outbound, scope granulari per area/cliente, OAuth.

## File toccati

- `supabase/migrations/...` — tabelle `api_keys`, `api_request_logs` + RLS admin-only + GRANT
- `supabase/functions/public-api/index.ts` — nuova edge function con router
- `supabase/config.toml` — registrazione `public-api` con `verify_jwt = false`
- `src/components/ApiKeysManagement.tsx` — nuovo componente
- `src/pages/Settings.tsx` — nuovo tab "API"
- `src/components/docs/ApiReferenceSection.tsx` + registrazione in `docSections.ts`

## Domande ancora aperte (rispondi quando ti senti)

1. Vuoi che la chiave sia **scopabile per area/cliente** già in v1, o un'unica scope globale `projects:read` va bene?
2. Devo includere anche le **attività/budget items** del progetto come endpoint annidato `/projects/:id/activities`, oppure rinviamo?
3. Vuoi un **endpoint `/clients`** companion (lista clienti) o solo dati progetto?

Se rispondi "tutto come proposto" parto così.
