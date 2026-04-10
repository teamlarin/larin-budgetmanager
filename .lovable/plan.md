

## Gestione marginalità nel preventivo

### Chiarimento logica
Il prezzo netto dei servizi nel preventivo **include già** il margine del 30% dal budget. Quindi:
- **Budget target** (costo operativo) = prezzo_netto_servizi / (1 + margine/100)
- Se il margine cambia, il prezzo netto servizi viene ricalcolato: `budget_target * (1 + nuovo_margine/100)`
- Le ore vengono dal budget (`total_hours`), la tariffa media = budget_target / ore

### Intervento

**File: `src/pages/QuoteDetail.tsx`**

1. **Nuovo state `marginPercentage`** inizializzato da `quote.margin_percentage || 30`, sincronizzato nell'`useEffect` esistente (riga 238-243).

2. **Calcolo budget target**: derivato dal totale budget meno i prodotti, poi scorporato del margine:
   ```
   budgetTotalNoProducts = budget.total_budget - productsGrossTotal
   budgetTarget = budgetTotalNoProducts / (1 + originalMargin/100)
   ```
   Quando il margine cambia, il `servicesTotal` viene ricalcolato come `budgetTarget * (1 + newMargin/100)`.

3. **Ricalcolo servizi con margine**: Il `servicesTotal` nel riepilogo diventa dinamico in base al margine. I singoli servizi mantengono i loro prezzi netti come riferimento, ma il totale servizi viene sovrascrivato dal calcolo con margine.

4. **Sezione "Marginalità" nel Riepilogo** (dopo subtotali, prima dello sconto):
   - Input editabile per la % di margine (in modalità editing)
   - **Budget target** (costo operativo senza margine)
   - **Ore budget** (da `budgets.total_hours`)
   - **Tariffa media** = budget_target / ore
   - **Prezzo servizi al cliente** (con margine applicato)

5. **Salvataggio**: aggiornare `margin_percentage` nella query di update (riga 328-336), ricalcolare `total_amount` con il nuovo margine.

6. **Query budget**: il budget è già fetchato come `quote.budgets` (alias `quote.projects`), quindi `total_budget` e `total_hours` sono disponibili.

### UI nel Riepilogo

```text
┌─────────────────────────────────────────┐
│ Riepilogo                               │
├─────────────────────────────────────────┤
│ Subtotale Servizi (netto)    €13.000    │
│ Subtotale Prodotti           €2.000     │
│ ─── Marginalità ───                     │
│ Margine               [  30  ] %        │ ← editabile
│ Budget target (costo)        €10.000    │
│ Ore budget                   200h       │
│ Tariffa media                €50/h      │
│ ────────────────────────────────────    │
│ Sconto                       0%         │
│ Totale dopo sconto           €15.000    │
│ IVA                          €3.300     │
│ Totale (IVA inclusa)         €18.300    │
└─────────────────────────────────────────┘
```

### File modificati
- **`src/pages/QuoteDetail.tsx`**: state margine, calcolo budget target, UI simulatore, salvataggio

