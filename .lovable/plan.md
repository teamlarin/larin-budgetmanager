

## Arrotondamento ore contabili ai 5 minuti più vicini

### Cosa cambia

Dopo aver applicato le maggiorazioni percentuali, le ore contabili vengono arrotondate al multiplo di 5 minuti più vicino. Esempi: 39m → 40m, 59m → 1h, 2h 17m → 2h 15m.

### Come

Aggiungere una funzione utility `roundToNearest5Minutes(hours: number): number` in `src/lib/utils.ts`:
- Converte le ore decimali in minuti
- Arrotonda al multiplo di 5 più vicino (`Math.round(minutes / 5) * 5`)
- Riconverte in ore decimali

Applicare l'arrotondamento in **2 punti**:

| File | Dove | Modifica |
|------|------|----------|
| `src/lib/utils.ts` | Nuova funzione | `roundToNearest5Minutes` |
| `src/components/ProjectTimesheet.tsx` | `calculateAccountingHours` (riga 451) | Wrappare il return con `roundToNearest5Minutes(...)` |
| `supabase/functions/public-timesheet/index.ts` | `applyAdjustment` (riga ~168) | Arrotondare il risultato prima di restituirlo + deploy |

### Dettaglio tecnico

```typescript
export function roundToNearest5Minutes(hours: number): number {
  const totalMinutes = hours * 60;
  const rounded = Math.round(totalMinutes / 5) * 5;
  return rounded / 60;
}
```

Questo garantisce coerenza tra timesheet interno e pagina pubblica.

