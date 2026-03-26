

## Fix: progresso errato nel ProgressUpdateDialog per progetti recurring

### Problema
Il progetto "Bortoluzzi - Marketing Operativo 2026" è `recurring` con `start_date: 2026-01-01` e `end_date: 2026-12-31`. Il valore `progress` nel DB è 268 (residuo da calcoli precedenti). Il ProgressUpdateDialog riceve `project.progress || 0` = 268 invece del valore calcolato dall'avanzamento temporale (~23% oggi).

### Soluzione
Calcolare il progresso temporale **prima** di passarlo al dialog, in tutti i punti dove il ProgressUpdateDialog viene aperto per progetti recurring.

### Modifiche

**1. `src/pages/ApprovedProjects.tsx`** (~riga 1120):
- Nella `onClick` che apre il dialog, calcolare `displayProgress` per recurring (stessa formula già usata a riga 1051-1057) e passarlo come `progress` nello state `progressDialogProject`

**2. `src/pages/ProjectCanvas.tsx`** (~riga 1175):
- Calcolare il progresso temporale per recurring prima di passare `currentProgress` al dialog, usando `project.start_date` e `project.end_date`

**3. `src/components/ProjectProgressUpdates.tsx`**:
- Stesso calcolo per il `currentProgress` passato al dialog interno

### File modificati
- `src/pages/ApprovedProjects.tsx`
- `src/pages/ProjectCanvas.tsx`
- `src/components/ProjectProgressUpdates.tsx`

