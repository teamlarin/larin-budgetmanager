

## Riscrittura integrazione Fatture in Cloud

### Stato attuale
L'integrazione è composta da 4 Edge Functions e 1 componente frontend, con una tabella `fic_oauth_tokens` nel DB:

- **fatture-in-cloud-oauth** — OAuth flow (get-auth-url, callback, check-connection, disconnect)
- **fatture-in-cloud-register-webhook** — Gestione subscription webhook FIC per sync fornitori
- **fatture-in-cloud-webhook** — Riceve webhook FIC e sincronizza fornitori nel DB
- **fatture-in-cloud-send-quote** — Invia preventivi a FIC
- **FattureInCloudIntegration.tsx** — UI nella tab integrazioni
- **QuoteDetail.tsx** — Pulsante "Invia a FIC" nel dettaglio preventivo

### Problemi identificati
1. Token refresh duplicato (implementato separatamente in ogni function)
2. CORS headers inconsistenti tra le functions
3. La webhook function non gestisce il token refresh
4. Validazione JWT inconsistente (soft auth in oauth, strict in send-quote, nessuna in webhook)
5. Nessuna validazione input con Zod
6. Codice boilerplate ripetuto ovunque

### Piano di riscrittura

#### Step 1 — Riscrivere `fatture-in-cloud-oauth/index.ts`
Riscrittura completa con:
- CORS headers aggiornati (formato esteso)
- Validazione input con Zod per le azioni POST (action, appUrl)
- Helper condiviso `getValidToken()` con auto-refresh integrato
- Stesse azioni: `get-auth-url`, `check-connection`, `disconnect` + callback OAuth
- JWT validation in-code per azioni POST (check-connection/disconnect)
- Mantenere `verify_jwt = false` per gestire il callback GET senza auth

#### Step 2 — Riscrivere `fatture-in-cloud-register-webhook/index.ts`
- Stessa struttura ma con helper `getValidToken()` inline (non si possono condividere moduli tra functions)
- Validazione input Zod (action, subscriptionId)
- CORS headers aggiornati
- JWT validation in-code (solo admin)

#### Step 3 — Riscrivere `fatture-in-cloud-webhook/index.ts`
- Aggiungere token refresh automatico (attualmente fallisce se il token è scaduto)
- CORS headers aggiornati
- Logging migliorato
- Gestione errori più robusta

#### Step 4 — Riscrivere `fatture-in-cloud-send-quote/index.ts`
- Helper `getValidToken()` inline con auto-refresh
- Validazione input Zod (quoteId)
- CORS headers aggiornati
- JWT validation in-code migliorata

#### Step 5 — Riscrivere `FattureInCloudIntegration.tsx`
- Componente più pulito e leggibile
- Gestione errori migliorata con messaggi più chiari
- Stato di loading per ogni azione separata
- Mantenere stessa UX: connessione OAuth, stato webhook, gestione subscription

#### Step 6 — Verificare `QuoteDetail.tsx`
- Nessuna modifica necessaria se le API delle functions rimangono identiche (stessi input/output)

### Dettagli tecnici
- Ogni Edge Function avrà il proprio helper `getValidToken()` (non è possibile importare moduli condivisi tra functions Supabase)
- Pattern comune per il token refresh: check expiry con 5 min buffer, refresh automatico, update nel DB
- La tabella `fic_oauth_tokens` e la tabella `suppliers` restano invariate (nessuna migrazione DB)
- I secrets esistenti (`FATTURE_IN_CLOUD_CLIENT_ID`, `FATTURE_IN_CLOUD_CLIENT_SECRET`, `FATTURE_IN_CLOUD_API_KEY`) restano gli stessi
- `supabase/config.toml` resta invariato

