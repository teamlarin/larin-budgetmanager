

## Fix discrepanze nei calcoli margine/tariffa media

### Problema identificato
Ci sono due bug nella logica di calcolo in `QuoteDetail.tsx`:

1. **La tariffa media cambia quando si modifica il margine** — Attualmente `averageRate = adjustedServicesTotal / budgetHours`, quindi cambiando il margine dal 30% al 20%, la tariffa scende da 66 a 58. Ma la tariffa media dovrebbe restare fissa (66) a meno che non venga modificata esplicitamente dall'utente.

2. **Condizione fragile con `marginPercentage !== originalMargin`** — Il codice usa un confronto esatto con 30 per scegliere il percorso di calcolo. Questo crea discontinuità e problemi dopo il salvataggio/ricaricamento.

### Soluzione
Semplificare la logica con un approccio lineare:

```
baseCost = baseServicesTotal × 0.70   (costo interno fisso)

Se customRate impostato:
  prezzoCliente = customRate × ore
Altrimenti:
  prezzoCliente = baseCost / (1 - margine%)

budgetTarget = prezzoCliente × (1 - margine%)

tariffaMedia (display):
  se customRate → customRate
  altrimenti → baseServicesTotal / ore  (sempre 66, indipendente dal margine)
```

### Comportamento atteso
| Azione | Prezzo cliente | Tariffa media | Budget target |
|--------|---------------|---------------|---------------|
| Default (30%) | 14.450 | 66 | 10.115 |
| Margine → 20% | 12.644 | 66 | 10.115 |
| Margine → 40% | 16.858 | 66 | 10.115 |
| Tariffa → 60 | 13.140 | 60 | 9.198 |
| Tariffa 60 + Margine 20% | 13.140 | 60 | 10.512 |

### File modificato
**`src/pages/QuoteDetail.tsx`** — due blocchi:
- Righe 592-609: logica calcolo display
- Righe 315-322: logica calcolo salvataggio

Stessa formula applicata in entrambi i punti.

