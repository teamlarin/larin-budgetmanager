

## Generare nuovo CRON_SECRET e aggiornare tutti i cron job

### Situazione attuale
- 6 cron job esistenti, tutti usano la **anon key** come Authorization header
- 7 Edge Function richiedono `CRON_SECRET`: `send-weekly-planning-reminder`, `send-monthly-timesheet-reminder`, `send-weekly-ai-summary`, `send-progress-reminder`, `check-margin-alerts`, `check-project-deadlines`, `sync-google-sheet`
- C'è un cron job **duplicato** per `send-weekly-planning-reminder` (jobid 4 e 5)
- Mancano cron job per `check-margin-alerts` e `check-project-deadlines`

### Intervento

**Passo 1 — Nuovo secret**
Generare un token sicuro e aggiornare il secret `CRON_SECRET` tramite lo strumento apposito.

**Passo 2 — Migrazione SQL**
Una singola migrazione per:

1. **Eliminare il cron job duplicato** (jobid 4, `send-weekly-planning-reminder` delle 09:00 — quello corretto è jobid 5 delle 16:30)
2. **Aggiornare i 5 cron job esistenti** sostituendo la anon key con il nuovo `CRON_SECRET` nell'header Authorization
3. **Creare 2 nuovi cron job**:
   - `check-margin-alerts` — ogni giorno alle 08:00
   - `check-project-deadlines` — ogni giorno alle 08:30

### Cron job risultanti dopo la migrazione

| Job | Funzione | Schedule |
|-----|----------|----------|
| `send-monthly-timesheet-reminder` | Timesheet ultimo giorno lavorativo | `0 9 * * *` |
| `invoke-send-weekly-planning-reminder` | Pianifica settimana | `30 16 * * 4` |
| `weekly-progress-reminder` | Progresso progetti | `0 16 * * 4` |
| `weekly-ai-summary` | AI summary | `0 9 * * 1` |
| `sync-google-sheet-hourly` | Sync Google Sheet | `0 */6 * * *` |
| `check-margin-alerts` | Alert margini budget | `0 8 * * *` (nuovo) |
| `check-project-deadlines` | Scadenze progetti | `30 8 * * *` (nuovo) |

### Dettagli tecnici

La migrazione userà `cron.unschedule()` per il job duplicato e `cron.alter_job()` per aggiornare i 5 job esistenti. Per i 2 nuovi job userà `cron.schedule()`. Tutti gli header conterranno `Bearer <CRON_SECRET>` generato al passo 1.

