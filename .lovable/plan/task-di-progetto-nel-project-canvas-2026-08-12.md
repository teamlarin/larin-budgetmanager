# Task di progetto nel Project Canvas

Aggiungere una gestione operativa delle **Task** dentro la scheda progetto, distinta dalle “Attività” di budget/timesheet: titolo, descrizione, assegnatario, stato, priorità, scadenza e link opzionale a una task di workflow esistente.

Verificato nel progetto: la tabella `project_tasks` non esiste, e non esistono ancora hook, helper o componenti per le task (nessun file `useProjectTasks`, `projectTaskSort`, `projectMembership`, cartella `project-tasks`). Il tab canvas oggi monta solo `ProjectActivitiesManager` e il Gantt.

## Cosa vedrà l'utente

- Nel tab **Canvas e Attività** una nuova sezione **Task**, sopra le Attività di budget.
- Lista in stile Asana/Linear: riga con titolo, badge priorità (alta/media/bassa), stato (Da fare / In corso / Fatto), scadenza con evidenza per date vicine o scadute, assegnatario.
- Creazione e modifica tramite pannello laterale (sheet) o riga inline; eliminazione con conferma.
- Filtri per stato/priorità/assegnatario e ordinamento per priorità o scadenza.
- Assegnatario scelto tra il team di progetto (membri + project leader).
- Campo opzionale per collegare la task a una task di workflow esistente (ricerca per titolo + flow); scollegabile.
- Chi non fa parte del progetto e non ha un ruolo con visibilità estesa non vede né modifica le task.

## Database (migrazione)

Nuova tabella `project_tasks` collegata al progetto con: titolo (obbligatorio), descrizione, assegnatario, stato (`todo|in_progress|done`, default `todo`), priorità (`high|medium|low`, default `medium`), data di scadenza, riferimento opzionale alla task di workflow (che resta intatta se la task di progetto viene eliminata), autore e date di creazione/aggiornamento con trigger.

Accesso: possono leggere e gestire le task gli utenti approvati che sono membri del progetto o project leader, i ruoli con visibilità globale (admin, team_leader, coordinator, account, finance) e gli utenti external limitatamente ai progetti a cui hanno già accesso. Grants espliciti per `authenticated` e `service_role`, RLS attiva con funzione `SECURITY DEFINER` per evitare ricorsioni. Indici su progetto, progetto+stato, assegnatario.

## Implementazione tecnica

- `src/lib/projectTaskSort.ts` — filtri e ordinamento puri: rank priorità high→medium→low, poi `due_date` ASC con null in fondo; filtro per stato.
- `src/lib/projectMembership.ts` — helper `isProjectTeamMember(userId, { leaderId, memberIds })` per il gate UI (membership progetto, non ruolo globale `member`).
- `src/hooks/useProjectTasks.ts` — React Query: list/create/update/delete, opzioni team (`project_members` ∪ project leader) e opzioni workflow (`workflow_flow_tasks` + nome flow).
- `src/components/project-tasks/ProjectTasksPanel.tsx` (+ riga lista e form) — UI con componenti shadcn esistenti (Card, Badge, Select, Popover+Calendar, Sheet, AlertDialog); date con `format(date,'yyyy-MM-dd')`.
- `src/pages/ProjectCanvas.tsx` — montare `ProjectTasksPanel` nel `TabsContent value="canvas"` prima di `ProjectActivitiesManager`.
- Test: `src/test/project-task-sort.test.ts` e `src/test/project-membership.test.ts` a copertura della matrice I/O (create/filter/sort/membership).
- Nessuna modifica a `budget_items` o ai workflow globali; naming UI sempre “Task”.

## Fuori scope (v1)

- Board Kanban / drag-and-drop.
- Stati aggiuntivi (cancelled, backlog).
- Sincronizzazione bidirezionale con il completamento delle task di workflow.
- Vista globale delle task fuori dal canvas.
