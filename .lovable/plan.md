

## Fix margine default 30% nel preventivo

### Problema
1. **Generazione preventivo** (`generateQuoteForBudget.ts`): il margine viene preso da `budgetData.margin_percentage || 0` — ma il prezzo dei servizi include già il 30% dal budget. Il margine salvato nel DB è 0, quindi il calcolo inverso in QuoteDetail non funziona.
2. **QuoteDetail.tsx**: usa `originalMargin` (dal DB, spesso 0) per scorporare il margine dal prezzo servizi — con margine 0 non scorpora nulla, quindi il budget target risulta uguale al prezzo servizi.

### Soluzione

**1. `src/lib/generateQuoteForBudget.ts`** — Impostare il margine default a 30:
```
const marginPercentage = budgetData.margin_percentage || 30;
```
E rimuovere la doppia applicazione del margine: il prezzo servizi (`servicePrice`) include già il 30%, quindi NON va applicato di nuovo. Il `servicesWithMargin` deve semplicemente essere `servicePrice` (il margine è già dentro). Il campo `margin_percentage` salvato sarà 30.

**2. `src/pages/QuoteDetail.tsx`** — Il `originalMargin` deve essere sempre 30 come base di partenza (è il margine "di fabbrica" del budget):
```
const originalMargin = 30; // Il budget include sempre il 30% di margine
```
Così il budget target viene calcolato correttamente: `servicesNet / 1.30 = costo operativo reale`.
Lo state `marginPercentage` si inizializza da `quote.margin_percentage ?? 30`.

### Effetto
- Default visibile: 30%
- Budget target = prezzo servizi / 1.30 (corretto)
- L'utente modifica il margine e vede il prezzo al cliente cambiare
- Il totale del preventivo riflette il margine scelto

### File modificati
- `src/lib/generateQuoteForBudget.ts`: margine default 30, rimuovere doppia applicazione
- `src/pages/QuoteDetail.tsx`: `originalMargin = 30` fisso come base di scorporo

