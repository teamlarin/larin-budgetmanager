# Task: collegamento ad attività previste + import da workflow

## Obiettivo

1. Una task non si collega più a una singola task di workflow: si collega (facoltativamente) a un'**attività prevista dal budget** del progetto (voci in "Attività previste").
2. I workflow si collegano al **progetto**: scegliendo un workflow (template o flow esistente) si importano tutte le sue task come task operative del progetto.

## Cosa cambia per l'utente

### Form task
- Il campo "Task di workflow collegata" viene rimosso.
- Nuovo campo facoltativo "Attività prevista", con l'elenco delle attività di budget del progetto corrente (nome attività + categoria). Valore vuoto = nessun collegamento.
- Nella lista/calendario/agenda, il badge del workflow viene sostituito da un badge con il nome dell'attività collegata.
- Nuovo filtro "Attività" nel pannello task, coerente con ricerca/ordinamento esistenti.

### Import workflow
- Nuovo pulsante "Importa da workflow" nella tab Task.
- Dialog con: selezione workflow (elenco template disponibili + flow già collegati al progetto), anteprima delle task che verranno create, campi opzionali comuni (assegnatario di default, data di scadenza di partenza, priorità).
- Alla conferma vengono create N task nel progetto (una per task del workflow), con titolo, descrizione, assegnatario e scadenza ereditati dal workflow quando presenti.
- Le task importate restano task normali: modificabili, eliminabili, filtrabili. Nessun legame vivo con il workflow (l'import è una copia una-tantum).

## Dettagli tecnici

**Database (migrazione)**
- `project_tasks`: aggiunta `budget_item_id uuid null references public.budget_items(id) on delete set null`, con indice su `(project_id, budget_item_id)`.
- Rimozione della colonna `workflow_flow_task_id` da `project_tasks` (nessuna logica dipendente oltre alla UI che si sostituisce).
- Le policy RLS esistenti su `project_tasks` restano valide (scoping per progetto): nessuna nuova policy necessaria.

**Hook `src/hooks/useProjectTasks.ts`**
- `ProjectTask` / input: `workflow_flow_task_id` → `budget_item_id`.
- `useWorkflowTaskOptions` sostituito da `useProjectBudgetActivityOptions(projectId)` che legge `budget_items` (id, activity_name, category) del progetto, escluse le voci prodotto.
- Nuovo `useImportWorkflowTasks(projectId)`: legge le task del workflow scelto (`workflow_flow_tasks` per un flow, `workflow_task_templates` per un template) e fa un insert multiplo in `project_tasks`, invalidando la query delle task.

**Componenti**
- `ProjectTaskFormSheet.tsx`: select attività (sentinella `__none__` → `NULL`).
- `ProjectTasksPanel.tsx`: badge attività, filtro attività, pulsante e dialog import.
- Nuovo `src/components/project-tasks/ImportWorkflowTasksDialog.tsx`.
- `ProjectTasksCalendar.tsx` / `ProjectTasksAgenda.tsx`: badge attività al posto del badge workflow; nessuna modifica alla logica DnD/cache oltre al fingerprint (aggiunta di `budget_item_id` ai campi tracciati in `projectTaskViewCache`).

**Test**
- Aggiornamento dei test esistenti che referenziano `workflow_flow_task_id`.
- Nuovo test per la mappatura task workflow → payload di insert delle task progetto.
