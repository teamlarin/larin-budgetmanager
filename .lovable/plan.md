

## Fix: allineare `isAutoProgress` a tutte le tipologie con progresso automatico

### Problema
In `ProgressUpdateDialog.tsx`, `isAutoProgress` controlla solo `recurring`, ma anche `pack` (ore confermate/totali), `interno` e `consumptive` (progresso disabilitato, valore -1) hanno progresso calcolato automaticamente. Questo causa:
- Per **pack**: il dialog permette di modificare manualmente il progresso e sovrascrive il valore calcolato nel DB
- Per **interno/consumptive**: il dialog mostra un campo progresso editabile che non ha senso

### Soluzione
Estendere la condizione `isAutoProgress` per includere `pack`, `interno` e `consumptive`, con messaggi descrittivi appropriati per ogni tipo.

### Modifiche

**`src/components/ProgressUpdateDialog.tsx`**:
- Cambiare `isAutoProgress` da `projectBillingType === 'recurring'` a `['recurring', 'pack', 'interno', 'consumptive'].includes(projectBillingType)`
- Differenziare il messaggio sotto l'input in base al tipo:
  - `recurring`: "Calcolato in base all'avanzamento temporale"
  - `pack`: "Calcolato in base alle ore confermate"
  - `interno`/`consumptive`: "Progresso non applicabile per questa tipologia"

**`src/pages/ApprovedProjects.tsx`**:
- Nella `onClick` che apre il dialog, applicare la stessa logica di calcolo progress anche per `pack` (usare il valore già presente nel progetto, che è calcolato dal backend)

**`src/pages/ProjectCanvas.tsx`**:
- Stessa coerenza: per `pack`, passare il progress calcolato; per `interno`/`consumptive`, passare 0 o -1

### File modificati
- `src/components/ProgressUpdateDialog.tsx`
- `src/pages/ApprovedProjects.tsx`
- `src/pages/ProjectCanvas.tsx`

