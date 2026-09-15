# Ore disponibili nel form task + attività collegata sotto la descrizione

Nel form "Nuova/Modifica task" l'utente inserisce le ore stimate senza sapere quante ore restano sull'attività prevista collegata. Obiettivo: mostrare il riferimento in tempo reale e riordinare il form.

## Cosa cambia per l'utente

1. **Il campo "Attività prevista collegata" si sposta subito dopo "Descrizione"** (prima di Stato/Priorità), così la scelta dell'attività guida il resto del form.
2. **Sotto il campo "Ore stimate" compare un'indicazione delle ore disponibili** sull'attività selezionata, con la formula scelta:
   - ore disponibili = **ore previste dell'attività − ore già lavorate/confermate** (timesheet con orario effettivo, stessa logica del canvas progetto).
   - Esempio di testo: "Disponibili 12,5h su 40h previste (27,5h già lavorate)".
3. **Se le ore stimate superano quelle disponibili**, appare un avviso in ambra non bloccante ("Superi le ore disponibili di Xh") — il salvataggio resta possibile.
4. L'indicazione si aggiorna appena si cambia attività; senza attività selezionata non viene mostrato nulla. Funziona identico nei tre punti di ingresso del form (CTA header, canvas progetto, widget dashboard).

## Note tecniche

- `src/hooks/useProjectTasks.ts`:
  - `useBudgetActivityOptions`: aggiungere `hours_worked` alla select e `hoursPlanned` a `BudgetActivityOption`.
  - Nuovo hook `useActivityConfirmedHours(budgetItemId: string | null)`: query su `activity_time_tracking` filtrata per `budget_item_id` con `actual_start_time` non nullo (select di `actual_start_time`, `actual_end_time`, paginata a blocchi da 1000 come in `ProjectActivitiesManager`), somma con `calculateSafeHours` da `@/lib/timeUtils`. Query key `['activity-confirmed-hours', budgetItemId]`.
- `src/components/project-tasks/ProjectTaskFormSheet.tsx`:
  - spostare il blocco "Attività prevista collegata" subito dopo il blocco "Descrizione";
  - nel blocco "Ore stimate", sotto l'input, mostrare il riepilogo disponibilità quando `activityId !== NONE`: ore previste dall'opzione selezionata (`hoursPlanned`), ore lavorate dall'hook, disponibili = max(0, previste − lavorate), formattazione ore con la stessa utility usata altrove (`formatHours`/`formatTrackedMinutes`);
  - avviso ambra (`text-amber-600` via token semantico) se `estimatedHours > disponibili`, solo testo informativo.
- Nessuna modifica al database; si riusano RLS e dati esistenti.
