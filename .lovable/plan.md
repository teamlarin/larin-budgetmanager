

## Aggiunta campo "Data Chiusura" ai budget

### Obiettivo
Aggiungere un campo `expected_close_date` (date) alla tabella `budgets` per registrare la data di chiusura prevista delle trattative, importata dal foglio Google Sheet. Questo campo servirà in futuro per simulare proiezioni di carico di lavoro ("what-if" su budget in bozza).

### Modifiche

#### 1. Migration: nuovo campo nella tabella budgets
```sql
ALTER TABLE public.budgets ADD COLUMN expected_close_date date;
```

#### 2. Edge Function `sync-budget-drafts` (nuova, dal piano precedente)
- Mappare la colonna "Data Chiusura" dal foglio 3 → `expected_close_date` nel budget
- Parsing della data dal formato presente nel CSV (es. `2024-06-30` o formato italiano)

#### 3. UI: mostrare il campo nel form budget
- **`src/components/BudgetManager.tsx`**: aggiungere un date picker per `expected_close_date` nella sezione dei dettagli del budget, visibile e modificabile manualmente
- Mostrare la data chiusura anche nella lista/card dei budget in bozza

#### 4. Aggiornamento tipi TypeScript
- Il tipo verrà aggiornato automaticamente da Supabase dopo la migration

### Note
- Il campo è nullable (i budget esistenti non avranno una data chiusura)
- La funzionalità di proiezione carico di lavoro ("what-if") sarà sviluppata separatamente in un secondo momento, utilizzando questo campo come base

