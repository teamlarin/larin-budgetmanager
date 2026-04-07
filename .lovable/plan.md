

## Ripristino notifiche email via cron

### Problema identificato
Tutte le Edge Function invocate dai cron job restituiscono **401 Unauthorized**. Questo succede perché:

1. Le funzioni richiedono nel codice un `CRON_SECRET` come Bearer token per autenticarsi
2. Il secret `CRON_SECRET` non esiste tra i secrets configurati del progetto
3. I cron job in `pg_cron` inviano la anon key come Authorization header, non il CRON_SECRET

Le funzioni interessate sono: `send-monthly-timesheet-reminder`, `send-weekly-planning-reminder`, `send-progress-reminder`, `send-weekly-ai-summary`. Anche `check-margin-alerts` e `check-project-deadlines` richiedono CRON_SECRET ma non hanno nemmeno un cron job configurato.

### Soluzione

Due opzioni possibili, entrambe equivalenti. La più semplice e meno invasiva:

**Opzione scelta: aggiornare i cron job per usare il CRON_SECRET**

1. **Aggiungere il secret `CRON_SECRET`** con un valore sicuro generato casualmente
2. **Aggiornare i 4 cron job** in `pg_cron` per usare il `CRON_SECRET` come Bearer token al posto della anon key (tramite migrazione SQL)
3. **Aggiungere i 2 cron job mancanti** per `check-margin-alerts` e `check-project-deadlines` (che attualmente non hanno cron job)

### Dettagli tecnici

**Secret**: aggiungere `CRON_SECRET` con valore generato

**Migrazione SQL**: aggiornare i 4 cron job esistenti sostituendo la anon key con il CRON_SECRET, e creare 2 nuovi cron job:
- `check-margin-alerts`: esecuzione quotidiana (es. ogni giorno alle 08:00)
- `check-project-deadlines`: esecuzione quotidiana (es. ogni giorno alle 08:30)

I cron job useranno la sintassi:
```sql
SELECT cron.alter_job(jobid, ...)
```
per aggiornare l'header Authorization con il nuovo CRON_SECRET.

Per i nuovi job:
```sql
SELECT cron.schedule(...)
```

### Funzioni non cron (invocate dal client)
Le funzioni come `send-budget-notification` e `send-leader-notification` sono invocate dal browser con il JWT dell'utente e funzionano correttamente. Nessuna modifica necessaria.

