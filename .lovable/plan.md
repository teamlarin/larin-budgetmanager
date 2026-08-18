# CTA rapida "Nuova task" + opzione "crea un'altra"

Obiettivo: creare una task in pochi click da qualsiasi punto dell'app, e poterne creare più di una di fila senza riaprire il form.

## Cosa cambia per l'utente

1. **Pulsante "Nuova task" nell'header globale** (accanto a tema/notifiche, visibile da tutte le pagine, escluso il ruolo external). Apre il form task con, in cima, la scelta del progetto tra quelli aperti in cui l'utente è leader o membro del team. Scelto il progetto, si popolano assegnatari e attività previste collegabili.
2. **Pulsante "Nuova task" nell'intestazione del Project Canvas**: stesso form, progetto già precompilato e non modificabile.
3. **Pulsante "Nuova task" nel widget "Le mie task"** della dashboard personale: apre lo stesso form con scelta progetto.
4. **Checkbox "Crea un'altra" nell'area di salvataggio** (solo in creazione, non in modifica): salvando, il form resta aperto e pronto per la task successiva. Vengono mantenuti progetto, attività collegata, assegnatario, priorità e scadenza; titolo e descrizione si svuotano e il focus torna sul titolo. La scelta della checkbox viene ricordata durante la sessione del form.

## Note tecniche

- `src/components/project-tasks/ProjectTaskFormSheet.tsx`:
  - nuove props opzionali `projectOptions?: {id,name}[]`, `projectId?`, `onProjectChange?` → quando presenti, primo campo "Progetto" (Select con ricerca testuale se la lista è lunga); il pulsante di salvataggio resta disabilitato senza progetto.
  - nuova prop `showCreateAnother?: boolean` e `createAnother`/`onCreateAnotherChange` (o stato interno) → `Checkbox` "Crea un'altra" nel `SheetFooter`, mostrata solo quando `task === null`.
  - dopo un submit riuscito con checkbox attiva: reset parziale dei campi via callback `onSubmit(input, { keepOpen: true })`; il chiamante non chiude lo sheet.
- Nuovo `src/components/project-tasks/QuickTaskButton.tsx`: componente riusabile con props `projectId?` (fisso) e `variant/size/label`. Gestisce apertura sheet, progetto selezionato, e usa gli hook esistenti `useProjectTasks(projectId).createTask`, `useProjectTeam`, `useBudgetActivityOptions`.
- Nuovo hook `useMyTaskProjects()` in `src/hooks/useProjectTasks.ts`: progetti con `project_status = 'aperto'` dove l'utente è `project_leader_id` o presente in `project_members` (stessa logica già usata in `PlanActivityHoursDialog`), ordinati per nome; usato solo quando serve la scelta progetto.
- Integrazioni: `src/components/AppHeader.tsx` (nascosto per `effectiveRole === 'external'`, icona + testo, testo nascosto sotto `lg`), intestazione di `src/pages/ProjectCanvas.tsx` (con `projectId`), header del widget `MyTasksWidget.tsx`.
- Nessuna modifica al database: si usa la stessa `createTask` con RLS esistente; il toast "Task creata" già presente conferma ogni salvataggio.
