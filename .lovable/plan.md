

## Risposta breve

- **Tasto "Aggiorna"**: funziona ma fa solo refetch della tabella, non lancia job. È normale.
- **Job giovedì**: è partito sia automaticamente alle 12:00 IT, sia manualmente (2 volte oggi), ma **tutti hanno risposto 401 Unauthorized**. Zero bozze nuove generate.

## Causa

Il vault Supabase (`vault.secrets`) è **vuoto**. Tutti i cron costruiscono l'header `Authorization: Bearer ` (stringa vuota) leggendo da `vault.decrypted_secrets WHERE name = 'CRON_SECRET'` → la edge function rifiuta con 401. Il fix del piano precedente sul vault non è mai andato a buon fine (probabilmente perché `vault.create_secret` richiede il valore reale di CRON_SECRET, che non era stato re-immesso).

Esiste già la RPC `admin_set_cron_secret(p_secret text)` pronta per ripopolare il vault.

## Cosa farò

### 1. Ripopolare il CRON_SECRET nel vault
Recupero il valore corrente di `CRON_SECRET` dai secret delle edge function (è già configurato lì, è quello che le funzioni validano in ingresso) e lo inserisco nel vault chiamando `admin_set_cron_secret(<valore>)`. Verifico subito con `SELECT name FROM vault.secrets` che la riga esista.

### 2. Test di un cron a basso impatto
Lancio manualmente `monitor-cron-failures-every-30min` (job HTTP innocuo) e controllo `net._http_response`: se torna 200 il vault è a posto.

### 3. Trigger reale di `generate-slack-progress-drafts-thursday`
Lo lancio manualmente con l'RPC `admin_run_cron_job_now(23)` (lookbackDays=8 è già nel comando) e:
- Verifico `net._http_response` → deve essere 200 con un JSON di esito.
- Conto le righe nuove in `project_update_drafts` per vedere quante bozze sono effettivamente nate (e quanti progetti sono stati skippati per "no segnali").
- Controllo i log della edge function `generate-slack-progress-drafts`.

### 4. Migliorare la trasparenza nel Monitor Sistema
Per evitare di avere dubbi simili in futuro:

- **RPC `admin_run_cron_job_now`**: oggi salva sempre `status='queued'` con `request_id=NULL` perché esegue il comando del job così com'è (`SELECT net.http_post(...)`). Lo modifico in modo che, quando il comando matcha il pattern standard `SELECT net.http_post(...)`, estragga il `request_id` di pg_net e lo salvi su `cron_manual_invocations.request_id`. Aggiungo anche aggiornamento status a `sent`.
- **Nuova RPC `admin_get_manual_invocations(p_limit)`**: ritorna le ultime invocazioni manuali joinate con `net._http_response` per mostrare status_code, body sintetico e durata.
- **UI `CronJobsMonitor.tsx`**:
  - Sotto il tab "Storico run" aggiungo un nuovo tab **"Esecuzioni manuali"** con: data, job, utente, status_code della risposta HTTP, esito, snippet body.
  - Nel toast di "Esegui ora" aggiungo: dopo 5s rifaccio una query mirata e mostro il `status_code` reale ricevuto (es. "200 OK · 142 bozze elaborate" oppure "401 Unauthorized · controlla CRON_SECRET").
  - Pulsante "Aggiorna" rinominato in **"Aggiorna ora"** con un tooltip che chiarisce che ricarica i dati visualizzati e non avvia job.

### 5. Rendere l'RPC più robusta
La whitelist attuale accetta qualsiasi comando con `net.http_post`. Aggiungo:
- timeout esplicito (`timeout_milliseconds`) se non già presente nel comando,
- log dell'header Authorization "vuoto" come warning chiaro (`error_message: 'CRON_SECRET vault entry missing'`) prima ancora di chiamare `net.http_post`, così il prossimo Esegui spiega da solo perché fallirà.

## Cosa NON cambio

- Logica della funzione `generate-slack-progress-drafts`.
- Schedule dei cron (giovedì già 12:00 IT, martedì 21:00 IT come deciso).
- RLS di `project_update_drafts` né il banner UI.

## Riepilogo tecnico

- Migration: aggiorna `admin_run_cron_job_now` per catturare `request_id` da pg_net e salvarlo nel record audit + warning preventivo se vault vuoto. Crea `admin_get_manual_invocations`.
- File toccati: `src/components/dashboards/CronJobsMonitor.tsx` (nuovo tab + toast con esito reale + label bottone), `src/integrations/supabase/types.ts` (auto).
- Operazione runtime una tantum: chiamata a `admin_set_cron_secret(<valore CRON_SECRET>)` per ripopolare il vault, poi rilancio manuale di jobid 23.

