## Diagnosi

La sincronizzazione automatica fornitori da Fatture in Cloud non funziona perché **il webhook non viene mai invocato** dai server di FIC.

Verifica eseguita:
- `supabase--edge_function_logs` su `fatture-in-cloud-webhook` → **nessun log**, quindi FIC non sta chiamando l'endpoint.
- Codice in `fatture-in-cloud-webhook/index.ts`: gestisce solo verifica via `GET ?validationToken=...`, mentre **FIC v2 invia la verifica come `POST` con campo `verification` nel body** (handshake). Senza risposta corretta a quell'handshake la subscription resta in stato `not_verified` e FIC non invia mai eventi.
- Inoltre, anche se arrivassero eventi, la logica attuale ha alcune lacune:
  - parsea `payload.type` ma in FIC v2 i campi sono `event_type` / `entity_type` / `entity_id` dentro `data`
  - su evento `delete` NON elimina (entra nel ramo "fetch supplier" e usa il 404 come fallback — fragile)
  - su `create`/`update` cerca `existing` per `fic_id`, ma se il match non c'è crea sempre con `user_id` del primo admin → potenziali duplicati se il fornitore esisteva già con stesso nome ma senza `fic_id`
  - non aggiorna **i contatti** del fornitore (l'utente ha menzionato "contatti", che in FIC sono persone collegate al fornitore — vedi sotto la domanda)

## Cosa propongo

### 1. Correggere l'handshake di verifica webhook
Aggiornare `supabase/functions/fatture-in-cloud-webhook/index.ts`:
- Su `POST`, se il body contiene `{ "verification": "<token>" }` rispondere `200` echo del token in JSON `{ "verification": "<token>" }` come da specifica FIC v2.
- Mantenere anche il fallback `GET ?validationToken=...` per compatibilità.

### 2. Allineare il parsing degli eventi al formato reale FIC v2
- Estrarre `event_type` (es. `it.fattureincloud.webhooks.entities.suppliers.delete`) e `entity_id` dal payload corretto.
- Switch esplicito su `create | update | delete`:
  - **delete** → `DELETE FROM suppliers WHERE fic_id = entity_id` senza fare la GET API (più veloce e non dipende dal 404).
  - **create / update** → fetch del supplier dall'API e upsert.
- Logging strutturato (event_type, entity_id, esito) così possiamo vederlo in `edge_function_logs`.

### 3. Upsert robusto su `suppliers`
- Match prima per `fic_id`; se non esiste, fallback su match per `vat_number` o `name+email` (per evitare duplicati di fornitori già presenti manualmente). Se trovato, valorizziamo il `fic_id` e aggiorniamo.
- Mantenere `user_id` esistente quando si aggiorna.

### 4. Backfill / "Sync ora" manuale
Aggiungere una nuova action `sync-all` in `fatture-in-cloud-register-webhook` (oppure una nuova edge function `fatture-in-cloud-sync-suppliers`) che:
- Scarica TUTTI i suppliers da FIC paginando (`/c/{company_id}/entities/suppliers?per_page=100&page=N`).
- Esegue l'upsert come sopra.
- **Elimina i suppliers locali con `fic_id` non più presenti su FIC** (così copre il caso "eliminato in FIC mentre il webhook era rotto").
- Ritorna un riepilogo `{ created, updated, deleted }`.

Esposta nel pannello `FattureInCloudIntegration.tsx` con un bottone "Sincronizza ora" + indicatore `lastSyncAt` (salvato in `app_settings` chiave `fic_suppliers_last_sync`).

### 5. Stato webhook visibile in UI
Mostrare in `FattureInCloudIntegration.tsx` lo stato `verified` di ogni subscription (campo restituito da FIC) e un bottone "Re-verifica" che cancella e ricrea la subscription se non è verificata.

## Domanda

L'utente parla di "contatti": in Fatture in Cloud "fornitori" e "contatti dei fornitori" sono entità distinte. La sincronizzazione attuale gestisce solo l'entità **Supplier** (anagrafica fornitore). Vuoi che includa anche:

- A) solo i fornitori (anagrafica + dati di contatto principali: email/telefono/indirizzo che già sono nel record supplier). **← consigliato, è quello che FIC espone via webhook `suppliers.*`**
- B) anche le persone/contatti collegate al fornitore (richiede webhook + tabella separata; FIC li espone come sotto-risorsa, non c'è un evento dedicato → andrebbe fatto con sync periodico, non in tempo reale)

Procedo con A salvo diversa indicazione.

## File toccati

- `supabase/functions/fatture-in-cloud-webhook/index.ts` — fix handshake + parsing eventi + delete/upsert robusto
- `supabase/functions/fatture-in-cloud-register-webhook/index.ts` — aggiunta action `sync-all` (oppure nuova function dedicata)
- `src/components/FattureInCloudIntegration.tsx` — bottone "Sincronizza ora", badge stato verificato per ogni subscription, ultima sync

Nessuna migrazione DB necessaria (uso `app_settings` per `last_sync`).