
## Fix: errore FK durante duplicazione budget

### Causa root
Console log:
```
"insert or update on table \"budget_items\" violates foreign key constraint \"budget_items_project_id_fkey\""
"Key is not present in table \"projects\"."
```

In `src/pages/Index.tsx` riga 404, il payload dei `budget_items` duplicati imposta:
```ts
project_id: newBudget.id, // Keep for backward compatibility
```

Ma `budget_items.project_id` ha una FK verso `projects(id)`, non `budgets(id)`. `newBudget.id` è l'id del nuovo budget (tabella `budgets`), che non esiste nella tabella `projects` → Postgres rifiuta l'insert con `23503`.

Il `try/catch` cattura l'errore, mostra il toast, ma il **budget padre è già stato creato** (riga 376) → l'utente lo vede nella lista, vuoto.

### Fix
Modificare il payload in modo che `project_id` venga copiato **solo** se il budget originale è già collegato a un progetto reale; altrimenti `null`.

```ts
const buildPayload = (item: any, parentIdMap?: Record<string, string>) => ({
  budget_id: newBudget.id,
  project_id: originalBudget.project_id ?? null, // FK valida solo se esiste
  ...
});
```

Nota: il nuovo budget eredita anche `project_id` solo se è opportuno. Per coerenza, **non** lo ereditiamo (un duplicato di budget parte come nuovo budget non agganciato a un progetto). Questo è già il comportamento attuale (riga 376-386 non include `project_id`).

### File modificati
- `src/pages/Index.tsx` riga 404 — sostituire `newBudget.id` con `originalBudget.project_id ?? null`

Nessuna modifica DB. Solo una riga di codice.

### Effetto atteso
- Duplicazione budget va a buon fine senza errori
- Tutte le attività (parent + children con gerarchia) vengono copiate correttamente
- Tutti i campi extra (is_product, vat_rate, payment_terms, ecc.) già gestiti dal fix precedente continuano a funzionare
