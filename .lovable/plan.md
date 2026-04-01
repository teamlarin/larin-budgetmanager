

## Due fix: dashboard ore confermate + calendario totali weekend

### 1. Fix doppia sottrazione banca ore nella dashboard

**Problema:** In `UserHoursSummary.tsx`, le ore "banca ore" vengono escluse dal totale `confirmedHours` tramite `return` anticipato (righe 188 e 283), ma poi sottratte di nuovo nella formula del saldo (riga 848: `adjustedConfirmed - expectedHours - monthBancaOre`). Risultato: doppia sottrazione.

**Fix — `src/components/dashboards/UserHoursSummary.tsx`:**

- **Riga 188**: Rimuovere il `return` dopo `bancaOre += hours`, così le ore banca ore vengono aggiunte anche a `total` (colonna Confermate)
- **Riga 283**: Stessa cosa per la query YTD — rimuovere il `return` dopo il tracking banca ore mensile, così le ore finiscono anche in `totals[user_id]`

Dopo il fix:
- **Confermate** includerà tutte le ore (comprese banca ore)
- **Saldo** = `(confermate + rettifiche) - previste - bancaOre` → singola sottrazione corretta

### 2. Calendario: totali settimanali includano anche ore del weekend nascosto

**Problema:** Quando i weekend sono nascosti (`showWeekends: false`), `weekDays` esclude sabato e domenica. Di conseguenza `dailyTotals` e `weeklyTotals` ignorano le ore schedulate nei weekend, anche se esistono attività confermate.

**Fix — `src/pages/Calendar.tsx`:**

- Nel `useMemo` di `dailyTotals` (~riga 1082): calcolare i totali su **tutti i 7 giorni** della settimana (non solo `weekDays`), indipendentemente da `showWeekends`
- Creare una variabile `allWeekDays` (sempre 7 giorni da `currentWeekStart`) e usarla per il calcolo dei totali
- `weekDays` continua a essere usato per il rendering della griglia (invariato)

In pratica:
```
const allWeekDays = Array.from({ length: config.numberOfDays }, (_, i) => addDays(currentWeekStart, i));

const weeklyTotals = useMemo(() => {
  // Calcola su allWeekDays, non su weekDays
  ...
}, [allWeekDays, timeTracking]);
```

Il `weeklyTotals` nel `CalendarHeader` mostrerà così il totale completo della settimana, anche con weekend nascosti.

### File modificati
1. `src/components/dashboards/UserHoursSummary.tsx` — rimuovere 2 `return` (righe 188, 283)
2. `src/pages/Calendar.tsx` — usare tutti i giorni della settimana per il calcolo totali

