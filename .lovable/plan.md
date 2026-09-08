# Nuovi stati delle task: Backlog, Bloccato e colori coerenti

## Cosa cambia per chi usa TimeTrap

Gli stati delle task diventano cinque, in questo ordine:

1. **Backlog** — nuovo, è lo stato predefinito quando si crea una task
2. **Da fare**
3. **In corso**
4. **Completato**
5. **Bloccato** — nuovo, si trova dopo Completato

Lo stato **In revisione** viene rimosso: le task che oggi lo usano passano a **In corso** (nessuna task viene perduta).

Colori coerenti con il significato, usati in modo identico nella lista task, nel calendario, nell'agenda, nel widget "Le mie task" e nella sidebar:

- Backlog: grigio neutro (non ancora in lavorazione)
- Da fare: blu (pronta da iniziare)
- In corso: giallo/ambra (lavoro attivo)
- Completato: verde
- Bloccato: rosso (attenzione, ferma)

Il resto resta invariato: solo "Completato" segna la data di completamento e genera l'eventuale occorrenza ricorrente successiva; filtri, raggruppamenti, ordinamenti e trascinamento continuano a funzionare con i nuovi stati.

## Database (migrazione)

- Aggiornare il vincolo di controllo su `project_tasks.status` ai valori `backlog`, `todo`, `in_progress`, `done`, `blocked`.
- Convertire le righe esistenti con `in_review` in `in_progress`.
- Impostare il valore predefinito della colonna a `backlog`.
- Nessuna modifica a permessi o regole di accesso.

## Implementazione tecnica

- `src/lib/projectTaskSort.ts`: tipo `ProjectTaskStatus` = `backlog | todo | in_progress | done | blocked`; `STATUS_RANK` (backlog 0, todo 1, in_progress 2, done 3, blocked 4), `STATUS_LABELS` aggiornate.
- Nuovo helper condiviso `STATUS_CLASSES` (token semantici, no colori hardcoded fuori dai token esistenti) esportato da un unico punto e usato da `ProjectTasksPanel.tsx`, `ProjectTasksAgenda.tsx`, `ProjectTasksCalendar.tsx`, `MyTasksWidget.tsx`, `TeamWeekView.tsx`, `Calendar.tsx`, al posto delle mappe locali con `in_review`.
- `useProjectTasks.ts`: default di creazione `backlog` (create, quick-create, clonazioni); logica `completed_at`/ricorrenza invariata (solo `done`).
- `ProjectTaskFormSheet.tsx`: stato iniziale `backlog`, elenco opzioni nel nuovo ordine.
- `ProjectTasksPanel.tsx`: filtri e azioni multiple con i cinque stati; conteggio "aperte" = tutte tranne `done`.
- `src/lib/mcp/tools/project-tasks.ts` e `supabase/functions/mcp/index.ts`: valori di stato ammessi aggiornati; rigenerare `.lovable/mcp/manifest.json`.
- `useWeeklyFocus.ts`, `projectCriticality.ts`, `projectTaskViewCache.ts` (bump versione cache): sostituire riferimenti a `in_review`.
- Test: aggiornare `project-task-sort.test.ts`, `project-task-view-cache.test.ts`, `project-tasks-calendar.test.tsx`, `project-criticality.test.ts` con i nuovi stati.

## Fuori scope

- Stati personalizzabili per progetto.
- Automatismi legati a "Bloccato" (notifiche, motivo del blocco).
