

# Miglioramento flusso Budget

## Problema
Il flusso attuale non distingue tra budget appena creati, in lavorazione e pronti per revisione. L'account non può assegnare formalmente la redazione a un team leader/coordinator.

## Proposta

### 1. Nuovo campo "Assegnato a" (assigned_to) sul budget
Aggiungere una colonna `assigned_user_id` alla tabella `budgets` per tracciare chi è responsabile della redazione del budget. Distinto da `user_id` (creatore) e `account_user_id` (account di riferimento).

### 2. Nuovi stati intermedi
Estendere gli stati del budget da 3 a 5:
- `bozza` — appena creato, ancora in compilazione
- `in_revisione` — il redattore ha finito, in attesa di approvazione del team leader
- `in_attesa` — (mantenuto per backward compat, equivale a "in revisione" per budget esistenti)
- `approvato` — approvato, genera preventivo
- `rifiutato` — rifiutato, da rivedere

### 3. Notifiche di assegnazione
Quando l'account assegna un budget a un utente (campo "Assegnato a"), inviare una notifica in-app e opzionalmente email. Quando il redattore cambia lo stato a "In Revisione", notificare il team leader.

### 4. Aggiornamenti UI

**Pagina lista budget (`Index.tsx`)**:
- Aggiungere colonna "Assegnato a" nella tabella
- Aggiornare il filtro stati per includere i nuovi stati
- Badge colori: bozza (grigio), in_revisione (blu), in_attesa (giallo), approvato (verde), rifiutato (rosso)

**Pagina dettaglio budget (`ProjectBudget.tsx`)**:
- Aggiungere campo editabile "Assegnato a" nell'header (come già fatto per Account)
- Aggiornare `BudgetStatusSelector` con i nuovi stati

**Dialog creazione (`CreateProjectDialog.tsx`)**:
- Aggiungere campo opzionale "Assegna a" per assegnare direttamente alla creazione

**`BudgetStatusBadge.tsx`**:
- Aggiungere mapping colori/label per i nuovi stati

### 5. Logica permessi
- Chi è `assigned_user_id` può modificare il budget e cambiare stato a `in_revisione`
- Solo team_leader, admin, coordinator possono cambiare stato a `approvato`/`rifiutato`
- L'account può assegnare il budget e vederlo

## Dettagli tecnici

### Migrazione DB
```sql
-- Aggiungere colonna assigned_user_id
ALTER TABLE budgets ADD COLUMN assigned_user_id uuid REFERENCES auth.users(id);

-- Aggiungere nuovi valori all'enum budget_status
ALTER TYPE budget_status ADD VALUE IF NOT EXISTS 'bozza';
ALTER TYPE budget_status ADD VALUE IF NOT EXISTS 'in_revisione';

-- Aggiornare budget esistenti senza stato esplicito
UPDATE budgets SET status = 'bozza' WHERE status = 'in_attesa' AND total_budget = 0;
```

### File da modificare

| File | Modifica |
|------|----------|
| `supabase/migrations/` | Nuova migrazione per `assigned_user_id` e nuovi stati enum |
| `src/components/BudgetStatusBadge.tsx` | Aggiungere badge per `bozza` e `in_revisione` |
| `src/components/BudgetStatusSelector.tsx` | Aggiungere i nuovi stati, logica permessi per transizioni |
| `src/pages/ProjectBudget.tsx` | Aggiungere campo "Assegnato a" editabile nell'header |
| `src/pages/Index.tsx` | Colonna "Assegnato a", filtro nuovi stati, badge aggiornati |
| `src/components/CreateProjectDialog.tsx` | Campo opzionale "Assegna a" |
| `src/integrations/supabase/types.ts` | Aggiornare tipi per nuovi stati e campo |
| `supabase/functions/send-budget-notification/index.ts` | Gestire notifica assegnazione |

