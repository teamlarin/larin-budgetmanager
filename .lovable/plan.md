

## Correzione calcolo ore previste con contratti sovrapposti

### Problema
Daniele ha due contratti nel database che si sovrappongono da aprile 2026:
- Contratto vecchio: 2026-01-01 → 2026-12-31, 50h/mese
- Contratto nuovo: 2026-04-01 → 2026-12-31, 70h/mese

La funzione `calculateContractWorkingDays` somma i giorni lavorativi di tutti i contratti che ricadono nell'intervallo, contandoli doppi. Questo produce 100h previste anziché 70h.

### Interventi

**1. Correzione dato: aggiornare il contratto vecchio**
- Migrazione SQL per impostare `end_date = '2026-03-31'` sul contratto `9d3e8a94-7137-4213-82a8-3a2629b0cb50`

**2. Prevenzione futura nel codice (2 modifiche)**

**File `src/components/ProfileHoursBank.tsx`** e logica equivalente in `UserHoursSummary.tsx`:
- Modificare `calculateContractWorkingDays` per evitare di contare lo stesso giorno più volte quando i contratti si sovrappongono. Approccio: iterare i singoli giorni lavorativi e per ognuno verificare se cade in almeno un contratto attivo, contandolo una sola volta.

**File `src/components/UserContractPeriodsDialog.tsx`**:
- All'inserimento di un nuovo contratto, se un contratto precedente ha `end_date` che si sovrappone alla `start_date` del nuovo, aggiornare automaticamente la `end_date` del vecchio al giorno precedente la nuova `start_date`.

### Dettagli tecnici

Logica corretta per `calculateContractWorkingDays`:
```typescript
const calculateContractWorkingDays = (intervalStart, intervalEnd) => {
  if (contractPeriods.length === 0) {
    return calculateWorkingDaysForInterval(intervalStart, intervalEnd, closureDates);
  }
  // Count each working day only once if it falls in at least one active contract
  const allDays = eachDayOfInterval({ start: intervalStart, end: intervalEnd });
  return allDays.filter(day => {
    if (isWeekend(day)) return false;
    if (closureDates.some(cd => isSameDay(cd, day))) return false;
    return contractPeriods.some(p => {
      const pStart = parseISO(p.start_date);
      const pEnd = p.end_date ? parseISO(p.end_date) : new Date(2099, 11, 31);
      return !isBefore(day, pStart) && !isAfter(day, pEnd);
    });
  }).length;
};
```

Per `getContractDataForDate`: già restituisce il primo match, ma va ordinato per dare priorità al contratto più recente (con `start_date` più alta). Aggiungere un sort dei `contractPeriods` per `start_date` discendente prima dell'iterazione, così il contratto da 70h viene trovato per primo ad aprile.

