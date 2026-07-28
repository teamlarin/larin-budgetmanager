## Modifica
In `src/components/ProjectActivitiesManager.tsx` (riga 1332) rimuovere la guardia `activity.is_custom_activity` sul pulsante cestino, così che appaia anche per le attività importate da template/budget.

Il flusso di conferma esistente (`handleDeleteClick` → `DeleteConfirmDialog` con opzioni "sposta ore" / "elimina ore", oppure `window.confirm` se non ci sono ore) è già adeguato: ogni eliminazione richiede sempre conferma esplicita.

## Note tecniche
Nessuna modifica DB necessaria: `budget_items` è già eliminabile via RLS. Il typecheck è verde (le stale errors elencate non sono più presenti).
