## Problema

Nel progetto "Management & pianificazione 2026" il tab **Timesheet** mostra 27h 15m di ore confermate invece delle 320h 15m attese.

**Causa root**: il progetto ha 5.382 righe in `activity_time_tracking` (4.150 confermate), ma la query in `src/components/ProjectTimesheet.tsx` (righe ~303-352, dentro `useQuery(['project-timesheet', projectId])`) legge le entries con un singolo `.select('*').in('budget_item_id', budgetItemIds)` senza paginazione. Supabase impone un limite di default di **1.000 righe** per risposta, quindi vengono caricate solo le prime 1.000 registrazioni. Tutte le somme (ore confermate, ore contabili, riepilogo attività, filtri) vengono calcolate su un sottoinsieme dei dati.

Le "Ore pianificate" (331h 15m) sono corrette perché derivano da `budget_items.hours_worked`, non da `activity_time_tracking`.

## Modifiche

**File**: `src/components/ProjectTimesheet.tsx`

Nella funzione `queryFn` di `useQuery(['project-timesheet', projectId])` (righe ~303-352), sostituire la fetch singola di `activity_time_tracking` con un loop paginato che raccoglie tutte le righe in batch da 1.000, usando `.range(offset, offset + 999)` finché il batch ritornato è pieno. Se `budgetItemIds` supera ~100 elementi, spezzare anche in chunk di budget_item_id per non superare la lunghezza massima dell'URL (stesso pattern già in uso in `supabase/functions/calculate-project-margins/index.ts`).

Nessuna altra modifica funzionale: il resto del componente continua a lavorare sull'array completo restituito da questa query.

## Verifica (post-implementazione)

- Aprire il progetto "Management & pianificazione 2026" → tab Timesheet
- Controllare che "Ore confermate" mostri ~320h 15m
- Controllare che il riepilogo attività e i filtri (utente/categoria/date) riflettano tutte le registrazioni
