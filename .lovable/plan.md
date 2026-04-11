

## Fix logica tariffa media custom nel preventivo

### Problema
La tariffa media visualizzata (66 €/h) è calcolata come **prezzo di vendita / ore** (`baseServicesTotal / budgetHours`). Ma quando l'utente inserisce una tariffa custom (es. 60), il codice la usa come **tariffa di costo**: `budgetTarget = 60 * ore`. Poiché il budget target di default è `66 * 0.70 * ore = 46 * ore`, inserire 60 lo alza anziché abbassarlo.

### Soluzione
La tariffa custom deve rappresentare la **tariffa di vendita** (come quella visualizzata di default). Il calcolo diventa:

- `adjustedServicesTotal = customRate * budgetHours` (prezzo servizi al cliente)
- `budgetTarget = adjustedServicesTotal * (1 - marginPercentage / 100)` (costo operativo derivato)

**File: `src/pages/QuoteDetail.tsx`** — righe 596-605:

Da:
```tsx
const defaultBudgetTarget = baseServicesTotal * (1 - originalMargin / 100);
const budgetTarget = customRate !== null && budgetHours > 0
  ? customRate * budgetHours
  : defaultBudgetTarget;

const adjustedServicesTotal = budgetTarget / (1 - marginPercentage / 100);

const averageRate = budgetHours > 0 ? Math.round(baseServicesTotal / budgetHours) : 0;
```

A:
```tsx
const defaultAdjustedServicesTotal = customRate !== null && budgetHours > 0
  ? customRate * budgetHours
  : baseServicesTotal;

const adjustedServicesTotal = marginPercentage !== 30 && customRate === null
  ? (baseServicesTotal * (1 - 30 / 100)) / (1 - marginPercentage / 100)
  : defaultAdjustedServicesTotal;

const budgetTarget = adjustedServicesTotal * (1 - marginPercentage / 100);

const averageRate = budgetHours > 0 ? Math.round(adjustedServicesTotal / budgetHours) : 0;
```

Logica:
- **Solo margine cambiato**: il costo (budget target originale) resta fisso, il prezzo al cliente si ricalcola col nuovo margine
- **Tariffa custom**: il prezzo al cliente = tariffa × ore, il budget target = prezzo × (1 - margine%)
- **averageRate**: ora riflette sempre il prezzo effettivo al cliente / ore

Stesso fix va applicato nella funzione `handleSave` (righe ~315-323) per la persistenza.

### File modificati
- `src/pages/QuoteDetail.tsx`: logica calcolo e salvataggio

