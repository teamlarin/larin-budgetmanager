

## Fix tariffa media nel preventivo per allinearla al budget

### Problema
La tariffa media nel **budget** viene calcolata come `totale_attività / ore` = €66/h.
Nel **preventivo** viene calcolata come `budget_target / ore` = `(totale_attività * 0.70) / ore` = €46/h.

Il budget target è il costo operativo (70% del totale), ma la tariffa media dovrebbe essere calcolata sul totale attività, come nel budget.

### Soluzione

**File: `src/pages/QuoteDetail.tsx`**

Cambiare il calcolo di `averageRate` (riga 605) da:
```tsx
const averageRate = budgetHours > 0 ? Math.round(budgetTarget / budgetHours) : 0;
```
a:
```tsx
const averageRate = budgetHours > 0 ? Math.round(baseServicesTotal / budgetHours) : 0;
```

Questo allinea il calcolo a quello del `BudgetSummaryCard` che usa `activitiesTotal / totalHours`.

La logica del `customRate` resta invariata: quando l'utente imposta una tariffa custom, questa guida il ricalcolo del budget target e del prezzo al cliente.

### File modificati
- `src/pages/QuoteDetail.tsx`: una riga, `budgetTarget` → `baseServicesTotal` nel calcolo di averageRate

