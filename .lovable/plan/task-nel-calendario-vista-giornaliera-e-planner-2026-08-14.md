# Task nel calendario (vista giornaliera e Planner)

Oggi nel calendario si pianificano solo le attività di budget. Aggiungiamo la possibilità di indicare **su quale task** si sta lavorando, restando sempre agganciati all'attività principale.

## Come funziona

1. Nel dialog di creazione/modifica di uno slot (vista Settimana/Giorno), dopo aver scelto l'attività compare un campo **Task (facoltativo)** con l'elenco delle task collegate a quell'attività (`budget_item_id` = attività scelta) del progetto, escluse quelle già completate/annullate.
2. Se non ci sono task collegate, il campo resta nascosto (nessun rumore visivo).
3. Nel **Planner** la riga "Aggiungi/Modifica attività" permette lo stesso: scelta attività + task facoltativa; gli slot generati per la settimana portano tutti la task selezionata.
4. Gli slot con task mostrano nel calendario e nel Planner il titolo della task sotto il nome attività (badge/etichetta piccola), così è chiaro cosa si sta pianificando.
5. Quando uno slot con task viene salvato/pianificato, la task passa automaticamente da "da fare" a **in corso** (se era ancora `todo`); nessun altro cambio di stato automatico.
6. Cambiando attività nel dialog la task selezionata viene azzerata (il vincolo attività→task resta sempre coerente).

## Note tecniche

- Migrazione: nuova colonna `task_id uuid null references public.project_tasks(id) on delete set null` su `activity_time_tracking`, con indice su `task_id`. Nessun cambio alle policy RLS esistenti (l'accesso resta guidato da `user_id`/progetto).
- `src/components/calendar/calendarTypes.ts`: aggiunta `task_id?: string | null` a `TimeTracking`.
- `src/pages/Calendar.tsx`:
  - nuova query (React Query) delle task candidate: `project_tasks` filtrate per `budget_item_id` in elenco attività della sidebar e `status not in ('done','cancelled')`, con batching `.in()` come già in uso;
  - `detailForm` acquisisce `task_id`; salvataggio in create/update di `activity_time_tracking`; reset su cambio attività;
  - dopo insert/update con `task_id`, update di `project_tasks.status = 'in_progress'` se lo stato corrente è `todo`;
  - select delle task aggiunta al dialog dettaglio, con placeholder sentinella `__none__` mappato a `NULL`;
  - invalidazione delle query key già usate + `project-tasks`/`my-tasks` per riflettere il cambio di stato.
- `src/components/calendar/PlanActivityHoursDialog.tsx`: nuovo campo task (stesse regole) e `task_id` nel payload; `planningUtils.ts` propaga `task_id` su tutti gli slot generati.
- `src/components/calendar/WeeklyPlanningView.tsx` e `ScheduledActivity.tsx`: visualizzazione del titolo task quando presente; il raggruppamento del Planner resta per progetto/attività, con dettaglio task nella riga.
- Date sempre con `format(date, 'yyyy-MM-dd')`; nessun `toISOString()` per le date.
