

## Fix cron job bozze progress update (e altri cron)

### Problema rilevato

1. **Il cron del giovedì NON è alle 12, è alle 13:00 ora italiana** (`0 11 * * 4` UTC). Quello del martedì è alle 21:00 italiane (`0 19 * * 2`). Quindi oggi non era ancora scattato a mezzogiorno.

2. **Più grave**: tutti i cron job che leggono `SUPABASE_URL` e `CRON_SECRET` dal `vault.secrets` stanno **fallendo da almeno 24 ore** con `null value in column "url"`. Il vault è **vuoto** (`SELECT name FROM vault.secrets` → 0 righe). Quindi anche alle 13:00 il job di oggi sarebbe fallito.

   Cron impattati attualmente rotti:
   - `generate-slack-progress-drafts-tuesday` / `-thursday` (bozze update)
   - `sync-budget-drafts-8am` / `-12pm` / `-6pm`
   - `send-progress-reminder` (giovedì 18:00)
   - probabilmente altri (margin alerts, deadlines, weekly AI summary)

### Cosa farò

**1. Migrare tutti i cron job dal vault a valori hardcoded sicuri**

Il `SUPABASE_URL` del progetto (`https://dmwyqyqaseyuybqfawvk.supabase.co`) non è un segreto e può stare direttamente nel comando del cron. Per `CRON_SECRET` invece serve il valore reale: lo leggo dai secret delle edge function (dove esiste sicuramente, visto che le funzioni lo validano in ingresso) e lo inserisco in vault correttamente, poi rifaccio puntare i cron lì.

Migrazione in due passi:
- a) Reinserisco `CRON_SECRET` e `SUPABASE_URL` in `vault.secrets` con `vault.create_secret(...)` 
- b) Verifico che `vault.decrypted_secrets` torni i valori (lo testo con un `net.http_post` manuale verso `generate-slack-progress-drafts`)

Se per qualche motivo il vault non si ripopola (es. permessi), fallback: riscrivo i comandi dei cron sostituendo la lettura dal vault con l'URL hardcoded e il `CRON_SECRET` letto da una nuova tabella `private.cron_config` (RLS bloccata) protetta a livello di schema.

**2. Allineare l'orario del cron giovedì alle 12 italiane**

Cambio `generate-slack-progress-drafts-thursday` da `0 11 * * 4` UTC (= 13:00 IT) a `0 10 * * 4` UTC (= 12:00 IT). Stessa cosa per il martedì se vuoi (ora 21:00 IT — confermami l'ora che preferisci, altrimenti lo lascio com'è).

**3. Trigger manuale immediato**

Subito dopo aver sistemato il vault, lancio una invocazione manuale di `generate-slack-progress-drafts` con `lookbackDays: 8` per generare adesso le bozze settimanali, così non aspetti il prossimo run.

**4. Verifica finale**

- Controllo `cron.job_run_details` dei prossimi run per vedere `status: succeeded`.
- Conto le bozze create in `project_update_drafts` con `status='pending'` e ti riepilogo per quanti progetti è partita la bozza, quanti sono stati skippati (no segnali / già aggiornati).

### Cosa NON cambio

- La logica della funzione `generate-slack-progress-drafts` (Slack + Drive Meet + Gmail) resta identica.
- Le RLS della tabella `project_update_drafts` restano identiche.
- Il banner UI `ProgressUpdateDraftBanner` non viene toccato — appena le bozze esistono in DB le mostra automaticamente.

### Domande / conferme

- L'orario del cron giovedì lo metto alle **12:00 italiane** (10 UTC), giusto?
- Vuoi che sposti anche il martedì dalle 21:00 IT a un orario più utile (es. martedì 12:00 IT)?

