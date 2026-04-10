

## Servizi nel preventivo: prezzo netto dal budget, lordo calcolato

### Problema attuale
I servizi mostrano il "Prezzo Lordo" preso dal totale attività del budget e questo è il campo modificabile. Il prezzo netto viene derivato dividendo per l'IVA. L'utente vuole l'inverso: il totale attività dal budget è il **prezzo netto**, modificabile, e il lordo si calcola automaticamente.

### Intervento

**File: `src/pages/QuoteDetail.tsx`**

1. **Query servizi (righe 148-152)** — Invertire la logica:
   - `net_price = totalActivities` (il budget è già netto)
   - `gross_price = net_price * (1 + vat_rate/100)`

2. **Tabella servizi (righe 754-860)** — Aggiungere colonna "Prezzo Netto" (editabile) e colonna "Prezzo Lordo" (calcolata, read-only):
   - Header: `Prezzo Netto` + `Prezzo Lordo`
   - Il campo editabile diventa `net_price`
   - Il lordo si mostra come `net_price * (1 + vat_rate/100)`

3. **updateService + recalcolo gross** — Quando si modifica `net_price` o `vat_rate`, ricalcolare `gross_price` automaticamente:
   ```tsx
   const updateService = (id, field, value) => {
     setEditingServices(prev => prev.map(s => {
       if (s.id !== id) return s;
       const updated = { ...s, [field]: value };
       const net = Number(updated.net_price || 0);
       const vat = Number(updated.vat_rate || 22);
       updated.gross_price = net * (1 + vat / 100);
       return updated;
     }));
   };
   ```

4. **Salvataggio (righe 273-286)** — Salvare sia `net_price` che `gross_price` calcolato.

5. **Calcoli totali (righe 556-577)** — `servicesTotal` deve usare `net_price` (coerente con i prodotti che già scorporano l'IVA). L'IVA servizi si calcola come `net_price * vat_rate/100`.

6. **Salvataggio quote totals (righe 288-293)** — Aggiornare `totalAmount` per usare i netti.

### Riepilogo modifiche
- Solo `src/pages/QuoteDetail.tsx`
- I servizi mostreranno: Prezzo Netto (editabile) | IVA % | Prezzo Lordo (auto-calcolato)

