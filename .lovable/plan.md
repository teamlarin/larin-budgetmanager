

## Tariffa media editabile nel preventivo

### Problema
La tariffa media nel preventivo (€46/h) non corrisponde a quella del budget (€66/h) perché viene calcolata come `budgetTarget / ore` dove il budgetTarget deriva dal prezzo netto servizi scorporato del 30%. Questo calcolo può divergere dal valore reale del budget.

### Soluzione
Rendere la tariffa media editabile nel preventivo. Quando l'utente la modifica, il sistema ricalcola:
- **Budget target** = tariffa * ore budget
- **Prezzo servizi al cliente** = budget target / (1 - margine/100)
- **Totale preventivo** = prezzo servizi + prodotti

### Intervento in `src/pages/QuoteDetail.tsx`

1. **Nuovo state `customRate`** (number | null): se impostato, sovrascrive il calcolo automatico della tariffa. Inizializzato a `null` (usa il calcolo default).

2. **Logica ricalcolo bidirezionale**:
   - Se l'utente cambia il **margine** → ricalcola prezzo servizi, la tariffa resta derivata (`budgetTarget / ore`)
   - Se l'utente cambia la **tariffa** → ricalcola `budgetTarget = tariffa * ore`, poi `adjustedServicesTotal = budgetTarget / (1 - margine/100)`

3. **UI**: in modalita editing, la tariffa diventa un input numerico (come il margine). In sola lettura resta testo.

4. **Salvataggio**: il `total_amount` e `discounted_total` vengono ricalcolati in base alla tariffa/margine correnti.

### File modificati
- `src/pages/QuoteDetail.tsx`: state customRate, logica ricalcolo, input editabile per tariffa

