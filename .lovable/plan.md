## Obiettivo

1. **Gestione Modelli** aperta a `admin`, `finance`, `team_leader`, `coordinator` (oggi: solo admin).
2. **"I miei Flussi Attivi"** mostra solo i flussi dove l'utente è **owner** o **assegnatario di almeno un task** (oggi: tutti i flussi).
3. **Sezione Archivio** separata per i flussi completati (oggi: filtro inline "Completati").
4. **Modelli con campo `area`** + filtro per area sia in lista modelli sia nel dialog "Nuovo Flusso".

## Cosa cambia per l'utente

### Tab e navigazione (`Workflows.tsx`)
- Tre tab al posto di due:
  - **I miei Flussi Attivi** → solo flussi dove l'utente corrente è owner OR ha almeno un task assegnato AND non completati.
  - **Archivio** → flussi completati (stessa logica di coinvolgimento: l'utente vede solo i suoi).
  - **Gestione Modelli** → visibile a admin / finance / team_leader / coordinator.
- L'admin vede comunque tutto (filtro "I miei" disattivabile via toggle "Mostra tutti i flussi" solo per admin).

### Modelli con Area
- Nel dialog Nuovo/Modifica Modello: nuovo Select **Area** (Marketing, Tech, Branding, Sales, Jarvis, Struttura, Interno) — opzionale.
- Nella lista modelli (`TemplateManagement`): badge colorato dell'area accanto al nome + barra filtri "Tutte le aree / Marketing / Tech / …" con conteggi.
- Nel dialog **Nuovo Flusso** (`CreateFlowDialog`): filtro per area sopra il select dei modelli, per restringere la lista quando ci sono molti template.

### Permessi gestione modelli
- I 4 ruoli abilitati (`admin`, `finance`, `team_leader`, `coordinator`) vedono il pulsante "Nuovo Modello", possono modificare/duplicare/eliminare.
- Gli altri ruoli non vedono la tab.

## Cosa cambia tecnicamente

### Database (1 migration)

1. **Aggiunta colonna `area`** su `workflow_templates` (text nullable, valori liberi limitati lato app):
   ```sql
   ALTER TABLE public.workflow_templates ADD COLUMN area text NULL;
   ```

2. **RLS gestione modelli** — sostituire le policy admin-only su `workflow_templates` e `workflow_task_templates`:
   ```sql
   DROP POLICY "Admins can insert templates" ON public.workflow_templates;
   DROP POLICY "Admins can update templates" ON public.workflow_templates;
   DROP POLICY "Admins can delete templates" ON public.workflow_templates;

   CREATE POLICY "Workflow managers can insert templates"
   ON public.workflow_templates FOR INSERT TO authenticated
   WITH CHECK (
     has_role(auth.uid(),'admin') OR has_role(auth.uid(),'finance')
     OR has_role(auth.uid(),'team_leader') OR has_role(auth.uid(),'coordinator')
   );
   CREATE POLICY "Workflow managers can update templates"
   ON public.workflow_templates FOR UPDATE TO authenticated
   USING (
     has_role(auth.uid(),'admin') OR has_role(auth.uid(),'finance')
     OR has_role(auth.uid(),'team_leader') OR has_role(auth.uid(),'coordinator')
   );
   CREATE POLICY "Workflow managers can delete templates"
   ON public.workflow_templates FOR DELETE TO authenticated
   USING (
     has_role(auth.uid(),'admin') OR has_role(auth.uid(),'finance')
     OR has_role(auth.uid(),'team_leader') OR has_role(auth.uid(),'coordinator')
   );
   ```
   Stesse 3 policy (drop+create) anche per `workflow_task_templates`.

3. Helper opzionale `public.can_manage_workflow_templates()` (SECURITY DEFINER) usato sia in UI che come policy condivisa, per evitare ripetizioni.

### Tipi (`src/types/workflow.ts`)
- Aggiunta `area?: string | null` su `WorkflowTemplate`.

### Hook (`src/hooks/useWorkflows.ts`)
- `fetchTemplates` legge `area` dal DB.
- `saveTemplate` insert/update include `area`.
- Nessun cambiamento alla logica di `useWorkflowFlows` (la RLS già consente la lettura agli approvati): il filtraggio "miei" avviene lato componente.

### Pagina (`src/pages/Workflows.tsx`)
- Recupero ruolo + `currentUserId` (già esiste `userRole`, aggiungo `currentUserId`).
- `canManageTemplates = ['admin','finance','team_leader','coordinator'].includes(userRole)`.
- Calcolo:
  - `myActiveFlows = flows.filter(f => !f.completedAt && (f.ownerId === uid || f.tasks.some(t => t.assigneeId === uid)))`
  - `myArchivedFlows = flows.filter(f => f.completedAt && (f.ownerId === uid || f.tasks.some(t => t.assigneeId === uid)))`
  - Per admin: toggle "Mostra tutti" → mostra tutti i flussi (active/completed).
- Tabs:
  - `active` → `<ActiveFlowsList flows={myActiveFlows} … />`
  - `archive` → `<ActiveFlowsList flows={myArchivedFlows} archived … />`
  - `templates` (solo se `canManageTemplates`).
- Header tab Archivio con conteggio.

### `ActiveFlowsList.tsx`
- Rimuovo lo `Select` "stato" (non più necessario: è la tab a separare attivi/archivio).
- Mantengo ricerca testuale e filtro Owner.
- Aggiungo filtro **Area** (legge `area` dei template tramite join lato hook — vedi sotto).
- Per gli archivi, mostro card in tono "soft" (opacity ridotta, badge "Completato il…").

Per avere `area` sul flusso senza modificare `workflow_flows`: estendo `ActiveFlow` con `templateArea?: string|null` popolato in `fetchFlows` con un secondo fetch leggero su `workflow_templates(id, area)` filtrato per `template_id` distinti.

### `CreateTemplateDialog.tsx`
- Aggiunta `Select` "Area" (con opzione "Nessuna") sopra "Task".
- Stato `area`, salva nel payload.

### `TemplateManagement.tsx`
- Header con barra filtri area (chip cliccabili o `Select`).
- Badge area accanto al nome del template (`getAreaColor` / `getAreaLabel`).
- Pulsante "Nuovo Modello" e azioni edit/duplicate/delete restano qui (la pagina già le wrappa).

### `CreateFlowDialog.tsx`
- Aggiunto `Select` "Filtra per area" sopra il select Template.
- I template vengono filtrati di conseguenza.

### `permissions.ts`
- Aggiungo `canManageWorkflowTemplates: boolean`:
  - `admin`, `finance`, `team_leader`, `coordinator` → `true`
  - altri → `false`
- Uso in `Workflows.tsx`.

## File toccati
- nuova migration `…_workflow_templates_area_and_managers.sql`
- `src/types/workflow.ts`
- `src/hooks/useWorkflows.ts`
- `src/pages/Workflows.tsx`
- `src/components/workflows/ActiveFlowsList.tsx`
- `src/components/workflows/TemplateManagement.tsx`
- `src/components/workflows/CreateTemplateDialog.tsx`
- `src/components/workflows/CreateFlowDialog.tsx`
- `src/lib/permissions.ts`

## Note
- L'archivio resta ordinato per `completed_at` desc.
- L'area è facoltativa: i template esistenti restano senza area e compaiono sotto "Senza area" nei filtri.
- Nessuna migrazione dati: solo schema + RLS.
- Le notifiche workflow esistenti restano invariate (owner / assignee / unblock / completed).
