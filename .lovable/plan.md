

## Fix doppia sottrazione banca ore nel Profilo (Banca Ore)

### Problema
In `ProfileHoursBank.tsx`, riga 314, il campo `confirmed` è calcolato come `regularHours + offRegularHours` — esclude `bancaOreHours`. Poi a riga 318 il saldo sottrae `bancaOre`: `(confirmed + adjustment) - expected - bancaOre`. Risultato: doppia sottrazione, identica al bug appena fixato in `UserHoursSummary.tsx`.

### Fix
**File: `src/components/ProfileHoursBank.tsx`** — riga 314

Includere `bancaOreHours` nel calcolo di `confirmed`:

```typescript
// Prima (bug):
const confirmed = isNonEmployee ? regularHours : regularHours + offRegularHours;

// Dopo (fix):
const confirmed = isNonEmployee ? regularHours : regularHours + offRegularHours + bancaOreHours;
```

Nessun'altra modifica necessaria: la formula del saldo (riga 318) e il CSV export usano già `confirmed` e `bancaOre` correttamente — con questa correzione, la sottrazione avviene una sola volta.

### Risultato
- **Confermate** includerà tutte le ore (comprese banca ore), allineato alla dashboard
- **Saldo** = `(confermate + rettifiche) - previste - bancaOre` → singola sottrazione

