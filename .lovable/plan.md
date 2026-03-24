

## Limitare le liste nella sezione Aggiornamenti Settimanali

### Problema
Le liste degli update e dei progetti senza aggiornamenti sono troppo lunghe, rendendo i roadblock difficili da individuare rapidamente.

### Soluzione

**File: `src/components/dashboards/WeeklyUpdatesWidget.tsx`**

1. **Separare roadblock dagli update normali**: dividere `sortedUpdates` in due liste — `roadblockUpdates` (con `roadblocks_text`) e `normalUpdates` (senza). I roadblock vengono mostrati sempre per intero in una card dedicata con bordo rosso, in cima.

2. **Collassare gli update normali**: mostrare solo i primi 5 update normali, con un pulsante "Mostra tutti (N)" per espandere. Stato `showAllUpdates` con `useState(false)`.

3. **Collassare i progetti senza aggiornamenti**: mostrare solo i primi 5 progetti stale, con un pulsante "Mostra tutti (N)" per espandere. Stato `showAllStale` con `useState(false)`.

4. **Layout rivisto**:
   - Card rossa "Roadblock attivi" con lista completa dei roadblock (sono pochi e critici)
   - Card "Aggiornamenti" con i primi 5 + espansione
   - Card ambra "Senza aggiornamenti" con i primi 5 + espansione

### Dettagli tecnici
- Due `useMemo` separati: `roadblockUpdates` e `normalUpdates` filtrati da `sortedUpdates`
- Slice a 5 per le liste collassate: `list.slice(0, showAll ? list.length : 5)`
- Pulsante `Button variant="ghost"` con testo "Mostra tutti (N)" / "Mostra meno"
- I roadblock restano con bordo rosso e sfondo `bg-destructive/5`

