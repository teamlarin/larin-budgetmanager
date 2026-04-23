

## Diagnosi sintetica

1. **La run manuale di `generate-slack-progress-drafts-thursday` non è mai arrivata alla edge function**: nessun log HTTP nei 30 minuti precedenti, nessun draft nuovo in DB dopo le 13:04 UTC.
2. **I cron job `tuesday` (22) e `thursday` (23) non hanno alcuna esecuzione registrata** in `cron.job_run_details` nelle ultime 24h, nemmeno quella schedulata per oggi alle 10:00 UTC. Sono `active=true` ma non scattano.
3. Diversi cron job vicini (jobid 10, 13, 17, 18) stanno fallendo con `null value in column "url" of relation "http_request_queue"` → il payload `cron.schedule(... net.http_post(url:=...))` riceve `url=null`, segnale che la sorgente dell'URL (probabilmente una `current_setting('app.supabase_url', true)` o un valore inserito hard-coded che è stato sovrascritto / svuotato) è vuota.
4. Bug separato: la RPC `admin_get_progress_drafts_status` esiste con signature `(p_week_start date)` ma in `CronJobsMonitor.tsx` viene chiamata senza argomenti → la tab "Stato Draft Progetti" non risponde, quindi non puoi diagnosticare via UI.

## Piano di intervento

### Step 1 — Ripristino dei cron job 22 / 23 (e degli altri rotti)

- Ispeziono il `command` di tutti i job in `cron.job` per capire come passano `url` e `Authorization`.
- Ricreo i job `generate-slack-progress-drafts-tuesday` e `generate-slack-progress-drafts-thursday` con `cron.schedule(...)` usando URL **hard-coded** (`https://dmwyqyqaseyuybqfawvk.supabase.co/functions/v1/generate-slack-progress-drafts`) e header `Authorization: Bearer <CRON_SECRET dal vault>`, con `cron.unschedule` preventivo per evitare duplicati.
- Stesso fix per i job 10/13/17/18 che falliscono con lo stesso pattern (li rimetto a posto in batch, leggendo cosa erano destinati a invocare).
- Migration applicata via tool DB (richiede approvazione utente).

### Step 2 — Fix della tab "Stato Draft Progetti"

- Aggiorno la chiamata in `CronJobsMonitor.tsx` per passare il parametro obbligatorio `p_week_start` (lunedì della settimana corrente in formato `YYYY-MM-DD`).
- Aggiungo un **bottone "Esegui ora"** nella tab che chiama `supabase.functions.invoke('generate-slack-progress-drafts', { body: { manual: true } })` con l'auth dell'admin loggato, mostrando spinner + risposta JSON. Così la prossima volta vedi subito l'esito senza dover andare in Supabase Dashboard.

### Step 3 — Verifica end-to-end

- Dopo il fix dei job, lancio manualmente la function via curl/UI e:
  - leggo i log edge per confermare che entra (dovrebbero apparire `[generate-slack] start`, contatori progetti, `[gmail-impersonate] ...`)
  - verifico che `project_update_drafts` riceva nuove righe con `gmail_inbox_used` valorizzato
  - controllo che le notifiche `progress_draft_ready` arrivino in `notifications`

### Step 4 — Monitoring (preventivo)

- Mi assicuro che il cron `monitor-cron-failures` (che già esiste) sia attivo e copra anche i nuovi 22/23, così la prossima volta che un job non riesce a inserire la chiamata HTTP ricevi un alert Slack invece di silenzio.

## Cosa vedrai dopo

- Tab "Stato Draft Progetti" funzionante con elenco progetti + inbox Gmail usata + bottone "Esegui ora".
- Cron del Tuesday/Thursday che girano davvero alle 19:00 e 10:00 UTC.
- Niente più fallimenti silenziosi: alert Slack se un job cron non parte.

## Note tecniche

- File modificati: nuova migration SQL per i job cron, `src/components/dashboards/CronJobsMonitor.tsx`.
- Nessuna modifica alla logica della function `generate-slack-progress-drafts` (è già ottimizzata e i secret SA sono a posto).
- Approvi e procedo con l'investigazione esatta del `command` dei job e con la migration di ripristino?

