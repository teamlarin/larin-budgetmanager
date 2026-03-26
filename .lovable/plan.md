

## Progresso automatico per progetti recurring nel ProgressUpdateDialog

### Problema
Nello screenshot si vede che il campo "Progresso (%)" è editabile anche per progetti recurring (dove il valore dovrebbe essere calcolato automaticamente dall'avanzamento temporale). Il project leader deve poter inserire solo Update e Roadblocks.

### Approccio
Aggiungere una prop `projectBillingType` al `ProgressUpdateDialog` (e a `ProjectProgressUpdates`). Per i progetti `recurring`:
- Il campo progresso diventa **read-only** con un testo esplicativo ("Calcolato automaticamente")
- Il salvataggio **non aggiorna** il campo `progress` nella tabella `projects` (usa il valore corrente senza sovrascriverlo)
- Il record in `project_progress_updates` viene comunque creato con il valore corrente di progresso

### Modifiche

**`src/components/ProgressUpdateDialog.tsx`**:
- Aggiungere prop `projectBillingType?: string`
- Se `projectBillingType === 'recurring'`: input progresso `disabled`, con nota "Calcolato in base all'avanzamento temporale"
- Nel `handleSave`: se recurring, skip l'update della tabella `projects.progress`

**`src/components/ProjectProgressUpdates.tsx`**:
- Passare `projectBillingType` al `ProgressUpdateDialog`

**`src/pages/ProjectCanvas.tsx`**:
- Passare `projectBillingType={project.billing_type}` sia a `ProgressUpdateDialog` che a `ProjectProgressUpdates`

**`src/pages/ApprovedProjects.tsx`**:
- Passare `projectBillingType` al `ProgressUpdateDialog` usato nella tabella progetti

**`src/components/dashboards/MemberDashboard.tsx`**:
- Passare `projectBillingType` al `ProgressUpdateDialog` nella dashboard membro

### File modificati
- `src/components/ProgressUpdateDialog.tsx`
- `src/components/ProjectProgressUpdates.tsx`
- `src/pages/ProjectCanvas.tsx`
- `src/pages/ApprovedProjects.tsx`
- `src/components/dashboards/MemberDashboard.tsx`

