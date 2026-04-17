

## Fix: Errore duplicazione budget + attività mancanti

### Causa root identificata

L'errore Postgres nei log:
```
null value in column "url" of relation "http_request_queue" violates not-null constraint
```

Il trigger `notify_project_leader_assignment` (su `INSERT` del budget) chiama `net.http_post` con:
```sql
url := current_setting('app.settings.supabase_url', true) || '/functions/v1/send-leader-notification'
```

I GUC `app.settings.supabase_url` e `app.settings.service_role_key` **non sono configurati** nel database → `current_setting(..., true)` ritorna `NULL` → `NULL || '/functions/...'` = `NULL` → `pg_net` rifiuta l'insert nella sua coda con errore NOT NULL.

L'errore non viene catturato dal blocco `EXCEPTION WHEN OTHERS` perché viene sollevato lato C dall'estensione `pg_net`, e bubbles up al client Supabase.

### Sequenza dell'errore lato client (`src/pages/Index.tsx` → `handleDuplicate`)

1. `INSERT` su `budgets` → riga creata con successo, ma il trigger AFTER INSERT fallisce → l'errore torna al client
2. Il `try/catch` JS riceve l'errore su `createError`/`throw`
3. Il flusso si interrompe **prima** di arrivare all'insert dei `budget_items` → il budget appare nella lista ma senza attività
4. L'utente vede toast "Errore durante la duplicazione" pur trovando il budget creato

### Intervento

**Migration SQL** che mette in sicurezza i due trigger che invocano `net.http_post`:

1. `notify_project_leader_assignment` (sui budget e tabelle simili)
2. Verificare anche `notify_budget_assignment` e `notify_activity_assignment` (analizzare se usano lo stesso pattern)

Modifiche alla funzione:
- Leggere i settings in variabili locali prima della chiamata
- Saltare la `PERFORM net.http_post` se url o key sono `NULL`/vuoti
- Loggare un `WARNING` invece di propagare l'errore

```sql
DECLARE
  v_supabase_url TEXT;
  v_service_key TEXT;
BEGIN
  ...
  v_supabase_url := current_setting('app.settings.supabase_url', true);
  v_service_key := current_setting('app.settings.service_role_key', true);
  
  IF v_email_enabled 
     AND v_supabase_url IS NOT NULL AND v_supabase_url <> ''
     AND v_service_key IS NOT NULL AND v_service_key <> '' THEN
    BEGIN
      PERFORM net.http_post(...);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Email notification failed: %', SQLERRM;
    END;
  END IF;
```

### Bonus fix (qualità della duplicazione)

Mentre siamo a sistemare `handleDuplicate` in `src/pages/Index.tsx`, completare le colonne copiate sui `budget_items` (oggi mancano):
- `is_product`, `product_id`
- `vat_rate`, `payment_terms`
- `duration_days`, `start_day_offset`
- `parent_id` (con remap dei vecchi id ai nuovi per le righe figlie)

Senza questo fix, anche dopo aver risolto l'errore del trigger, prodotti e gerarchie padre/figlio non verrebbero copiati correttamente.

### File modificati

- Nuova migration in `supabase/migrations/` che ricrea con `CREATE OR REPLACE FUNCTION` la funzione `notify_project_leader_assignment` (più eventuali altre `notify_*` con stesso bug)
- `src/pages/Index.tsx` — `handleDuplicate`: aggiungere campi mancanti e remap `parent_id`

### Note

- Nessuna modifica allo schema delle tabelle
- La GUC mancante è un problema infrastrutturale del database, ma il trigger deve essere comunque resiliente
- Dopo il fix la duplicazione funzionerà end-to-end senza errori

