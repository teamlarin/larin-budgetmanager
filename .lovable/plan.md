

## Fix margine default 30% nel preventivo

### Problema
La riga `setMarginPercentage(quote.margin_percentage ?? 30)` usa l'operatore `??` (nullish coalescing) che NON intercetta il valore `0` — solo `null`/`undefined`. I preventivi creati prima del fix hanno `margin_percentage = 0` nel DB, quindi il margine si inizializza a 0% invece di 30%.

Con margine 0%:
- `budgetTarget = baseServicesTotal / 1.30` (corretto)
- `adjustedServicesTotal = budgetTarget * 1.0` (sbagliato — dovrebbe essere `* 1.30`)
- Il totale risulta più basso del previsto

### Soluzione

**File: `src/pages/QuoteDetail.tsx`** — Cambiare `??` in `||` alla riga 244:
```tsx
setMarginPercentage(quote.margin_percentage || 30);
```

Questo fa sì che `0` venga trattato come falsy e sostituito con 30.

### File modificati
- `src/pages/QuoteDetail.tsx`: una riga, `??` → `||`

