# Planner: area di rilascio chiara, task pianificabili, layout su più colonne

## 1. Dove trascinare: area di rilascio visibile

- In cima al Planner compare una zona di rilascio tratteggiata dedicata: "Trascina qui un'attività o una task per pianificarla in questa settimana", accanto al pulsante "Aggiungi attività".
- Appena inizi a trascinare dalla barra laterale, la zona si accende (bordo e sfondo evidenziati) così è evidente dove lasciare; oggi si illumina solo quando ci passi sopra, e l'intera pagina come area unica non si capisce.
- Le due aree "Settimana precedente / successiva" restano come sono, ma si accendono solo quando trascini una riga già pianificata (comportamento attuale).

## 2. Trascinare una task non dà più "Attività non disponibile"

L'errore compare perché la task porta un'attività che non è nell'elenco della barra laterale (l'elenco contiene solo le attività assegnate all'utente), quindi il Planner non la trova e blocca.

- Al rilascio di una task, se l'attività non è nell'elenco, viene usata l'attività della task stessa (nome attività e progetto già disponibili sulla task): la modale "Ore previste in settimana" si apre normalmente con la task collegata.
- L'errore resta solo nel caso reale in cui la task non abbia nessuna attività collegata.

## 3. Layout su più colonne, pagina più corta

- Il contenitore passa da colonna centrata stretta a larghezza piena (con un massimo ampio), sfruttando lo spazio a destra.
- Prima fascia su due colonne: a sinistra il riepilogo settimana (ore pianificate / contratto / residuo, barra, aree spostamento settimana), a destra il "Riepilogo per progetto".
- Le schede dei progetti con le attività pianificate vanno in griglia a 2 colonne sugli schermi larghi (3 su schermi molto larghi), una sola colonna su mobile/tablet.
- La nota esplicativa sotto il riepilogo per progetto diventa più compatta per non allungare la colonna.

## Dettagli tecnici

- `src/components/calendar/WeeklyPlanningView.tsx`
  - Nuovo componente interno `PlannerDropTarget` con `useDroppable({ id: PLANNER_DROPZONE_ID })`; usa `active?.data.current?.type` per lo stato "in trascinamento" oltre a `isOver`. Il `useDroppable` sul contenitore radice resta come fallback.
  - Contenitore: `max-w-3xl mx-auto` → `max-w-[1600px] mx-auto`; nuova `grid gap-4 lg:grid-cols-2` per riepilogo settimana + riepilogo progetto; schede progetto in `grid gap-4 lg:grid-cols-2 2xl:grid-cols-3 items-start`.
- `src/pages/Calendar.tsx`
  - `openPlanFromDrop(budgetItemId, taskId, fallback?)`: se `activities.find(...)` è vuoto e arriva un fallback (dalla `PlannableTask`), costruisce un `Activity` sintetico con `id`, `activity_name`, `project_id` (aggiunto alla `PlannableTask` dal join già presente), `project_name`, categoria vuota e contatori a 0.
  - `handleDragEnd` sul ramo `PLANNER_DROPZONE_ID` passa la task come fallback.
  - `PlannableTask` (in `calendarTypes.ts`) acquisisce `project_id`, già disponibile nel join `budget_items`.
- Nessuna modifica al database né alla logica di distribuzione degli slot.
