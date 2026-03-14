

# Miglioramento Workflows: Scadenze, Filtri e Note

## 1. Migrazione Database

### Aggiungere `due_date` ai task attivi
```sql
ALTER TABLE workflow_flow_tasks ADD COLUMN due_date date DEFAULT NULL;
```

### Nuova tabella `workflow_task_comments`
```sql
CREATE TABLE workflow_task_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES workflow_flow_tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE workflow_task_comments ENABLE ROW LEVEL SECURITY;

-- Approved users can view comments on tasks they can see
CREATE POLICY "Approved users can view task comments"
  ON workflow_task_comments FOR SELECT TO authenticated
  USING (is_approved_user(auth.uid()));

CREATE POLICY "Approved users can insert task comments"
  ON workflow_task_comments FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND is_approved_user(auth.uid()));

CREATE POLICY "Users can delete own comments"
  ON workflow_task_comments FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
```

## 2. Filtri e Ricerca nella lista flussi (`ActiveFlowsList.tsx`)

Aggiungere sopra la griglia:
- **Input di ricerca** per nome flusso (client-side filter)
- **Select stato**: Tutti / In corso / Completati
- **Select owner**: Tutti / lista owner dai flussi correnti

Filtraggio lato client sui `flows` già caricati. Nessuna modifica al backend.

## 3. Scadenze ai Task (`FlowDetailView.tsx`)

- Aggiungere un **date picker inline** per ogni task (click su icona calendario accanto all'assignee)
- Badge colorato: **rosso** se scaduto, **arancione** se scade entro 2 giorni, altrimenti grigio
- Nuovo metodo `updateTaskDueDate(flowId, taskId, date)` nel hook `useWorkflows.ts`

## 4. Note/Commenti sui Task (`FlowDetailView.tsx`)

- Icona **MessageSquare** su ogni task card, con contatore commenti
- Click apre un **collapsible** sotto il task con:
  - Lista commenti (autore + data + testo)
  - Input per aggiungere un nuovo commento
- Nuovo metodo `addTaskComment` e fetch commenti nel hook

## 5. Aggiornamento Tipi (`src/types/workflow.ts`)

```typescript
interface ActiveTask {
  // ... existing fields
  dueDate: string | null;
}

interface TaskComment {
  id: string;
  taskId: string;
  userId: string;
  userName: string;
  content: string;
  createdAt: string;
}
```

## File da modificare

| File | Modifica |
|------|----------|
| Migrazione SQL | `due_date` + tabella `workflow_task_comments` |
| `src/types/workflow.ts` | Nuovi tipi `TaskComment`, campo `dueDate` |
| `src/hooks/useWorkflows.ts` | `updateTaskDueDate`, `fetchTaskComments`, `addTaskComment` |
| `src/components/workflows/ActiveFlowsList.tsx` | Filtri ricerca/stato/owner |
| `src/components/workflows/FlowDetailView.tsx` | Date picker scadenza + sezione commenti |
| `src/pages/Workflows.tsx` | Passare props filtri (se necessario) |

