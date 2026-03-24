

## Associare un livello a ogni utente

### Obiettivo
Aggiungere un campo `level_id` al profilo utente per collegarlo a un livello esistente (dalla tabella `levels`). Questo permette di:
1. Nella gestione utenti, assegnare un livello a ciascun utente
2. Nel form di creazione budget, suggerire utenti in base al livello dell'attività
3. Prevedere il carico di lavoro per area e livello

### 1. Database — Nuova migrazione

```sql
ALTER TABLE profiles ADD COLUMN level_id UUID REFERENCES levels(id) ON DELETE SET NULL;
```

### 2. Gestione Utenti — `UserManagement.tsx`

- Aggiungere `level_id` all'interfaccia `UserWithRole` e al `formData`
- Nella query `loadUsers`, fare un join o query separata sui `levels` per mostrare il nome del livello
- Nel form di creazione e modifica utente, aggiungere un `<Select>` per scegliere il livello (filtrato per area dell'utente, se impostata)
- Nella tabella utenti, mostrare una colonna "Livello" con il nome del livello assegnato
- Aggiungere un filtro per livello nella lista utenti

### 3. Form Budget — `BudgetItemForm.tsx`

- Quando si seleziona un livello per un'attività del budget, mostrare un suggerimento con gli utenti che hanno quel livello assegnato nel profilo
- Aggiungere un indicatore visivo (badge o tooltip) accanto agli utenti suggeriti nella lista assignee

### 4. Widget Carico Lavoro — `WorkloadSummaryWidget.tsx`

- Aggiungere la possibilità di raggruppare/filtrare il carico di lavoro per livello oltre che per area
- Mostrare il livello accanto al nome utente

### File coinvolti
- **Migrazione SQL**: aggiunta colonna `level_id` a `profiles`
- **`src/components/UserManagement.tsx`**: campo livello nel form e nella tabella
- **`src/components/BudgetItemForm.tsx`**: suggerimento utenti per livello
- **`src/components/dashboards/WorkloadSummaryWidget.tsx`**: raggruppamento per livello

