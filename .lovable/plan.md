## Problema

Nel calendario di TimeTrap, gli eventi Google sovrapposti si renderizzano uno sopra l'altro perché `GoogleCalendarEvent` usa una posizione assoluta fissa (`left-[15%] right-1`) senza alcuna logica di gestione delle sovrapposizioni. Nel caso mostrato, "amuseapp SAL dev" (14:30-15:00) viene completamente coperto da "Assofondi | Comparatore" (14:30-15:15), rendendo impossibile cliccarlo per collegarlo a un'attività.

Le attività interne (`ScheduledActivity`) hanno già una logica di overlap (`calculateOverlapPositions`) che divide lo spazio in colonne, ma gli eventi Google ne sono esclusi.

## Soluzione

Applicare la stessa logica di calcolo colonne agli eventi Google visibili in un dato giorno, e passare `column`/`totalColumns` a `GoogleCalendarEvent` per renderizzarli affiancati.

### Modifiche

**1. `src/components/calendar/ScheduledActivity.tsx`**
- Estrarre/generalizzare il calcolo overlap in una funzione utility che lavori su una lista di intervalli `{ id, startMin, endMin }` e ritorni `Map<id, {column, totalColumns}>`. Mantenere `calculateOverlapPositions` esistente come wrapper.

**2. `src/components/GoogleCalendarEvent.tsx`**
- Aggiungere prop opzionale `overlapPosition?: { column: number; totalColumns: number }`.
- Quando presente con `totalColumns > 1`, sostituire `left-[15%] right-1` con stile dinamico che divide lo spazio disponibile (es. base `left: 15%`, larghezza `(85% - padding) / totalColumns`, offset per `column`). Stessa formula usata in `ScheduledActivity` ma ancorata al 15% iniziale per mantenere il margine dal lato sinistro che lascia spazio alle attività interne.

**3. `src/components/calendar/CalendarGrid.tsx`** (righe 199-217)
- Prima di `.map(event => ...)` calcolare `googleOverlapPositions` per gli eventi Google del giorno (filtrati per `isSameDay`, non nascosti, non collegati, esclusi `allDay`) usando la stessa utility.
- Passare `overlapPosition={googleOverlapPositions.get(event.id)}` a `<GoogleCalendarEvent />`.

### Note

- Gli eventi all-day rimangono inalterati (rendering inline non posizionato).
- Non si fonde lo spazio con `ScheduledActivity` perché usano lane diverse (0-100% vs 15-100%): mantenere indipendenti evita regressioni nel layout esistente.
- Nessuna modifica DB / backend.

### Verifica

Aprire il giorno con due eventi Google sovrapposti (14:30-15:00 e 14:30-15:15): entrambi devono apparire affiancati e cliccabili per il collegamento all'attività.
