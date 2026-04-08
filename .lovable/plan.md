

## Fix: Budget Target deve escludere i prodotti

### Problema
Il "Budget target" in `BudgetSummaryCard.tsx` è calcolato come `summary.totalCost * 0.7`, ma `totalCost` include sia attività che prodotti. Dovrebbe essere basato solo sulle attività.

### Intervento

**File: `src/components/BudgetSummaryCard.tsx`**

Alla riga 33, sostituire `summary.totalCost` con `activitiesTotal` (già calcolato alla riga 17 come somma dei costi della `categoryBreakdown`, che esclude i prodotti):

```ts
// Da:
Budget target: {Math.round(summary.totalCost * 0.7).toLocaleString()} €

// A:
Budget target: {Math.round(activitiesTotal * 0.7).toLocaleString()} €
```

La variabile `activitiesTotal` è già presente nel componente (riga 17) e rappresenta esattamente il totale delle sole attività (la `categoryBreakdown` non include i prodotti, come si vede in `BudgetManager.tsx` righe 306-315).

Nessun'altra modifica necessaria.

