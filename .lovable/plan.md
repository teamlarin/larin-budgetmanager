

## Spostare cron generazione bozze: martedì 21:00 e giovedì 13:00

Aggiorno i due cron job esistenti che invocano `generate-slack-progress-drafts`.

### Stato attuale

- `generate-slack-progress-drafts-tuesday` → `0 19 * * 2` (martedì 19:00 UTC → 21:00 ora legale IT, 20:00 ora solare)
- `generate-slack-progress-drafts-thursday` → `0 10 * * 4` (giovedì 10:00 UTC → 12:00 ora legale IT, 11:00 ora solare)

### Nuovi orari richiesti

- **Martedì 21:00 IT** → `0 19 * * 2` UTC (CEST, ora legale, attiva ora) / `0 20 * * 2` UTC (CET, ora solare, da fine ottobre)
- **Giovedì 13:00 IT** → `0 11 * * 4` UTC (CEST) / `0 12 * * 4` UTC (CET)

pg_cron lavora **solo in UTC** e non gestisce automaticamente l'ora legale. Propongo schedule **fissi su CEST** (l'orario sarà esatto da fine marzo a fine ottobre, e di un'ora prima nei mesi invernali — martedì 20:00 e giovedì 12:00 da novembre a marzo). È l'approccio standard usato già negli altri cron del progetto.

### Modifiche

Eseguo via SQL diretta (non migrazione, contiene riferimento a vault):

```sql
-- Martedì 21:00 ora italiana (CEST)
SELECT cron.alter_job(20, schedule => '0 19 * * 2');

-- Giovedì 13:00 ora italiana (CEST)
SELECT cron.alter_job(21, schedule => '0 11 * * 4');
```

Il job 20 ha già lo schedule corretto per il martedì (`0 19 * * 2`); aggiorno solo il giovedì (job 21 da `0 10 * * 4` → `0 11 * * 4`).

### Verifica post-modifica

Rileggo `cron.job` e confermo i nuovi schedule.

### Nota

Se preferisci avere gli orari esatti anche d'inverno, l'unica soluzione è duplicare i job (uno per CEST, uno per CET) e attivarli/disattivarli stagionalmente — sconsigliato. Lasciamo lo scostamento di 1 ora nei mesi invernali come fanno gli altri cron già attivi.

