

## Cron bisettimanale per bozze Slack + lookback 8 giorni

Cambio il cron da una sola esecuzione settimanale a due, ed estendo la finestra di analisi messaggi a 8 giorni.

### Schedule

Sostituisco il cron job esistente (`generate-slack-progress-drafts-thursday`, attualmente giovedì alle 06:00 UTC) con due job:

- **Martedì 21:00 (Europe/Rome)** → cron `0 19 * * 2` UTC
- **Giovedì 12:00 (Europe/Rome)** → cron `0 10 * * 4` UTC

Entrambi i job chiamano la edge function `generate-slack-progress-drafts` con body `{"lookbackDays": 8}`.

Nota fuso orario: i cron sono espressi in UTC assumendo ora legale (CEST = UTC+2). In ora solare (CET = UTC+1) le esecuzioni cadranno alle 20:00 e 11:00 ora italiana. Se serve precisione anche d'inverno, posso aggiungere uno schedule alternativo ma per ora seguiamo la convenzione standard del progetto.

### Edge function

Modifico `generate-slack-progress-drafts/index.ts`:

1. **Lookback rispettato anche in modalità cron**: la funzione già legge `body.lookbackDays`. Default cron resta 7, ma con il body `{"lookbackDays": 8}` passato dai cron job verrà usata la finestra di 8 giorni come richiesto.
2. **Sempre nuova bozza il giovedì**: la deduplica attuale blocca la generazione se esiste già una bozza `pending` per la stessa `week_start` (lunedì). Cambio comportamento: in modalità cron, se esiste già una bozza pending della settimana corrente, la **sostituisco** (delete + insert nuova). La logica manuale (`force: true` da admin) mantiene il comportamento attuale.

### Database

Migration SQL per:
- `cron.unschedule(19)` (vecchio job giovedì)
- `cron.schedule('generate-slack-progress-drafts-tuesday', '0 19 * * 2', ...)` con body `{"lookbackDays": 8}`
- `cron.schedule('generate-slack-progress-drafts-thursday', '0 10 * * 4', ...)` con body `{"lookbackDays": 8}`

Entrambi usano `SUPABASE_URL` e `CRON_SECRET` dal vault, identico al pattern esistente.

### File toccati

- `supabase/functions/generate-slack-progress-drafts/index.ts` — sostituzione bozza pending in modalità cron
- Migration SQL — riconfigurazione cron jobs

Nessuna modifica RLS, schema tabelle o UI.

