# Task collegabili in "Nuova attività manuale"

Nel dialog del calendario (vista giorno/settimana) oggi si sceglie solo progetto e attività: il campo task manca, anche se lo slot salvato sa già gestirlo (come nel dialog dettaglio e nel Planner).

## Cosa cambia

1. Dopo la selezione dell'attività compare il campo **Task (facoltativo)** con l'elenco delle task aperte collegate a quell'attività, come già avviene nella modale di dettaglio slot e nel Planner.
2. Accanto al campo un pulsante **Nuova task**: apre il form task completo con progetto e attività prevista già preselezionati; appena creata, la task viene selezionata automaticamente nello slot che si sta creando.
3. Se l'attività non ha task collegate, il campo resta comunque disponibile solo tramite il pulsante "Nuova task" (nessuna select vuota).
4. Cambiando progetto o attività la task selezionata si azzera.
5. Salvando lo slot con una task, la task passa da "da fare" a "in corso" (comportamento già esistente, riutilizzato).
6. Per gli slot ricorrenti la task viene applicata a tutte le occorrenze generate, coerentemente con la logica attuale.

## Note tecniche

- `src/components/CreateManualActivityDialog.tsx`: nuovo stato `taskId`, reset su cambio progetto/attività e su apertura; render di `ActivityTaskSelect` (`src/components/calendar/ActivityTaskSelect.tsx`) con `budgetItemId = selectedParentActivityId`; `task_id` aggiunto al payload di `onSubmit` e al tipo delle props.
- Creazione rapida: riuso di `ProjectTaskFormSheet` con `useProjectTasks`/`useProjectTeam`/`useBudgetActivityOptions` (stesso schema di `QuickTaskButton.tsx`), pre-impostando `projectId` e l'attività prevista; su successo invalidazione di `['activity-tasks', budgetItemId]` e selezione della nuova task.
- `src/pages/Calendar.tsx`: la mutazione `createManualActivity` già accetta `task_id` e chiama `markTaskInProgress`; serve solo inoltrare il campo dal dialog.
- Nessuna modifica al database.
