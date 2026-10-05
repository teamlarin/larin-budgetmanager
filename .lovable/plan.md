# Override manuale delle ore previste mensili

## Obiettivo
Permettere ad admin e finance di impostare manualmente le ore previste di una persona per un singolo mese, sostituendo il calcolo automatico da contratto. Utile per eccezioni puntuali (es. mese con chiusure, accordi particolari) senza toccare il contratto.

## Cosa faccio

1. **Nuova tabella `user_expected_hours_overrides`**
   - Campi: `user_id`, `month` (primo giorno del mese), `expected_hours`, `reason` (motivazione opzionale), `created_by`, timestamp.
   - Vincolo di unicità su (user_id, month): un solo override per persona/mese.
   - Permessi: lettura per utenti autenticati (come le rettifiche), scrittura solo admin e finance via RLS con `has_role`.

2. **Modifica nel riepilogo ore team (`UserHoursSummary`)**
   - Carico gli override dell'anno selezionato.
   - Nel calcolo delle ore previste mensili e YTD: se esiste un override per quel mese, vince sul calcolo da contratto.
   - Il saldo (confermate + rettifiche − previste) usa il valore override quando presente.

3. **Modifica nel dettaglio mensile (`UserMonthlyDetail`)**
   - Nella colonna "Previste" aggiungo la matita di modifica (visibile solo ad admin/finance, come già per Rettifica).
   - Dialog di modifica: ore previste manuali + motivazione; possibilità di rimuovere l'override per tornare al calcolo automatico.
   - Indicazione visiva (es. asterisco o colore) quando il valore mostrato è un override manuale.
   - Gli utenti "consuntivo" restano senza previste (nessuna modifica).

4. **Nessun impatto su**
   - Contratti e periodi contrattuali (restano la fonte di calcolo standard).
   - Rettifiche ore esistenti (restano sommate alle confermate, come oggi).
   - Report Slack settimanali ed esportazioni esistenti (useranno automaticamente il valore override perché passano dallo stesso calcolo).

## Note tecniche
- Migrazione SQL: `CREATE TABLE public.user_expected_hours_overrides` con GRANT (authenticated read, service_role full), RLS abilitata, policy di scrittura con `public.has_role(auth.uid(), 'admin')` o `'finance'`.
- Il calcolo previste vive in `UserHoursSummary.tsx` (`calculateExpectedHoursForUser` + mappa mensile per `UserMonthlyDetail`): l'override viene applicato in entrambi i punti tramite una mappa `userId → { yyyy-MM → hours }`.
- Salvataggio con upsert su conflitto (user_id, month), stesso pattern delle rettifiche in `user_hours_adjustments`.
- Invalidazione query React Query dopo il salvataggio per aggiornare subito tabella e saldi.
