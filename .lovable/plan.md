

## Fix: ora di fine mancante negli eventi Google Calendar

### Problema
Quando un evento Google Calendar ha solo una data senza orario nel campo `end` (es. `"2026-04-09"` anziché `"2026-04-09T18:00:00+02:00"`), `parseISO` lo interpreta come mezzanotte e `format(..., 'HH:mm')` restituisce `"00:00"`. Questo accade per eventi tutto-il-giorno e per alcuni eventi multi-giorno.

Il flag `allDay` copre solo il caso in cui anche `start` è senza orario. Se `start` ha un `dateTime` ma `end` no (raro ma possibile), oppure se entrambi sono date-only, l'ora di fine nel dialog risulta `"00:00"`.

### Intervento

**File: `src/components/GoogleCalendarEvent.tsx`**
Nel `useEffect` che pre-popola i campi editabili, aggiungere un controllo: se l'ora di fine calcolata è `"00:00"` o precedente/uguale all'ora di inizio, impostare l'ora di fine a ora di inizio + 1 ora.

**File: `src/pages/Calendar.tsx`**
Nella `convertGoogleEventMutation`, applicare lo stesso fallback: se `scheduledEndTime` risulta `"00:00"` o ≤ `scheduledStartTime`, usare start + 1 ora come default.

### Dettagli tecnici

Logica del fallback (applicata in entrambi i file):
```ts
// Dopo aver calcolato endTime
if (endTime === '00:00' || endTime <= startTime) {
  const [h, m] = startTime.split(':').map(Number);
  endTime = `${String(Math.min(h + 1, 23)).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
```

Nessuna modifica al backend o al database.

