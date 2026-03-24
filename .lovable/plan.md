

## Fix: Previsionale errato per contratti mensili

### Problema
Per Giorgio Maria Sacchi (e tutti gli utenti con contratto mensile), il previsionale mostra valori assurdi (es. +99h 15m) perché `calculateExpectedHoursForMonth(tomorrow, endOfMonth)` tratta l'intervallo parziale come se fosse un mese intero.

La funzione calcola `contractData.hours * (userDays / totalMonthDays)` dove sia `userDays` che `totalMonthDays` sono calcolati sullo stesso intervallo parziale (domani → fine mese). Il rapporto è ~1, quindi restituisce le ore mensili intere (es. 120h) invece della quota pro-rata rimanente.

### Soluzione
Invece di riusare `calculateExpectedHoursForUser` / `calculateExpectedHoursForMonth` sull'intervallo parziale, calcolare le ore previste rimanenti come proporzione delle ore previste del mese intero:

```
expectedRemaining = expectedHours(mese intero) × (giorniLavorativiRimanenti / giorniLavorativiMeseIntero)
```

### Modifiche

**`src/components/dashboards/UserHoursSummary.tsx`** — blocco forecast (righe ~756-767):
- Calcolare `fullMonthWorkingDays` = giorni lavorativi da inizio a fine mese
- Calcolare `remainingWorkingDays` = giorni lavorativi da domani a fine mese
- `expectedRemaining = user.expectedHours * (remainingWorkingDays / fullMonthWorkingDays)`
- `forecastBalance = monthBalance + expectedRemaining`

**`src/components/ProfileHoursBank.tsx`** — blocco forecast (righe ~297-307):
- Stessa logica: usare `expected` (ore previste mese intero già calcolate) e proratare con i giorni lavorativi rimanenti rispetto al totale del mese

### File modificati
- `src/components/dashboards/UserHoursSummary.tsx`
- `src/components/ProfileHoursBank.tsx`

