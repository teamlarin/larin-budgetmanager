

## Bug: ore confermate nel calendario enormemente gonfiate

### Causa

`actual_start_time` e `actual_end_time` sono salvati come timestamp ISO completi (es. `2025-03-23T09:00:00.000Z`), ma nella riga 1092 di `Calendar.tsx` vengono passati direttamente a `calculateTimeMinutes()`, che si aspetta stringhe in formato `HH:mm`.

`calculateTimeMinutes` fa `split(':')` e `parseInt()` — su una stringa ISO come `2025-03-23T09:00:00.000Z`, il primo segmento è `2025-03-23T09`, che produce valori numerici assurdi. Questo spiega i 310h 45m per una singola settimana.

### Correzione

**File:** `src/pages/Calendar.tsx`, riga 1091-1093

Estrarre la parte oraria (`HH:mm`) dai timestamp ISO prima di passarli a `calculateTimeMinutes`:

```typescript
if (t.actual_start_time && t.actual_end_time) {
  const actualStart = t.actual_start_time.includes('T')
    ? t.actual_start_time.split('T')[1].substring(0, 5)
    : t.actual_start_time.substring(0, 5);
  const actualEnd = t.actual_end_time.includes('T')
    ? t.actual_end_time.split('T')[1].substring(0, 5)
    : t.actual_end_time.substring(0, 5);
  confirmedMinutes += calculateTimeMinutes(actualStart, actualEnd);
}
```

Questo gestisce sia il caso in cui i tempi sono già in formato `HH:mm` (o `HH:mm:ss`) sia il caso ISO completo.

### Nessun'altra modifica necessaria
- La query dati è corretta (filtra per utente e settimana)
- `calculateTimeMinutes` è corretta per input `HH:mm`
- Il totale settimanale (`weeklyTotals`) somma correttamente i `dailyTotals`

