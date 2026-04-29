# Fix: utente assegnato non compare nel popover "Assegna..."

## Contesto

Nel turno precedente ho cambiato la query di `assignments` in `ProjectActivitiesManager.tsx` per filtrare solo le righe "pure" (`scheduled_date IS NULL` AND `actual_start_time IS NULL`), pensando che il problema fosse l'opposto. In realtà il comportamento corretto era:

> **Pianificare un'attività in calendario equivale ad assegnarla.**

Quindi il fix attuale ha causato una **regressione**: utenti che hanno solo entry pianificate (con `scheduled_date`) non risultano più assegnati e la checkbox appare vuota → cliccandola si crea una nuova riga "pura", ma visivamente sembra non funzionare se poi si riapre il popover (in realtà ora salva, ma la logica concettuale è sbagliata).

Il vero bug originale per cui l'assegnazione "non funzionava" era probabilmente un altro (es. cache non invalidata, oppure utente già presente come pianificato e quindi il toggle lo "rimuove" invece di aggiungerlo). Vista l'indicazione dell'utente, la cosa giusta è:

1. **Ripristinare** la query `assignments` includendo TUTTE le righe `activity_time_tracking` (sia pure che pianificate che confermate) — una qualunque presenza = utente assegnato.
2. Sistemare `unassignUserMutation` perché, se l'utente è "assegnato via calendario", togliere la spunta non deve eliminare i suoi eventi pianificati. In quel caso il toggle deve essere **disabilitato** o mostrare un messaggio chiaro: "questo utente ha pianificazioni in calendario, rimuovile prima".

## Modifiche

### `src/components/ProjectActivitiesManager.tsx`

1. **Query `activity-assignments`** (righe ~280-314): rimuovere i filtri `.is('scheduled_date', null)` e `.is('actual_start_time', null)`. Tornare a fetchare tutte le righe `activity_time_tracking` per le attività del progetto e raggruppare per `budget_item_id` → `user_id` distinti.

2. **Aggiungere una seconda query** (o estendere quella sopra restituendo metadati) che identifica, per ogni coppia (activity, user), se esistono righe "pure" (`scheduled_date IS NULL AND actual_start_time IS NULL`). Serve per sapere se la rimozione dal popover è "sicura".

3. **`handleAssigneeToggle` / `unassignUserMutation`**:
   - Se l'utente ha SOLO righe pure → delete come oggi (funziona).
   - Se l'utente ha righe pianificate o confermate → mostrare un toast informativo: *"Impossibile rimuovere: l'utente ha eventi in calendario o ore confermate per questa attività. Rimuovili dal calendario prima di deselezionarlo."* e non eseguire la delete. In alternativa, disabilitare la checkbox in lettura con tooltip esplicativo.

4. **Checkbox UI** (riga ~1284): aggiungere `disabled` + `title` quando l'utente è assegnato implicitamente via calendario, così l'azione di "togliere la spunta" è chiaramente non distruttiva.

## Risultato atteso

- Assegnando dal popover "Assegna..." → la spunta appare e persiste (caso "pure assignment", come oggi).
- Pianificando dal calendario → l'utente compare automaticamente come assegnato nel popover (regressione risolta).
- Tentativo di rimuovere uno spuntato-via-calendario → feedback chiaro, nessuna cancellazione silenziosa di eventi.
