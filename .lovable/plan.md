# Il riquadro di pianificazione del planner non accetta i trascinamenti

Nel planner settimanale ci sono due aree di rilascio che usano **lo stesso identificativo**: l'intera area del planner e il riquadro tratteggiato "Trascina qui un'attività o una task". Avendo lo stesso nome, una sovrascrive l'altra e il rilascio non viene riconosciuto: si trascina l'attività o la task, ma non si apre nessuna finestra e non succede nulla.

## Cosa cambia

1. Il riquadro tratteggiato torna a funzionare: trascinando dentro un'attività o una task dalla barra laterale si apre la finestra per indicare le ore da pianificare nella settimana.
2. Funziona anche il rilascio sull'area del planner in generale, non solo dentro al riquadro: non serve centrare un bersaglio piccolo.
3. Il riquadro diventa più grande e più evidente: più alto, testo su due righe con l'indicazione della settimana in corso, e in evidenza (bordo e sfondo colorati) appena inizi a trascinare qualcosa di pianificabile.
4. Il riquadro viene posizionato in alto, subito sotto le ore della settimana, così è sempre visibile senza scorrere.

## Dettagli tecnici

- `src/components/calendar/WeeklyPlanningView.tsx`
  - `PLANNER_DROPZONE_ID` resta l'id del riquadro dedicato (`PlannerDropTarget`).
  - Nuovo `PLANNER_SURFACE_ID` esportato per il contenitore generale (riga 87), così i due `useDroppable` non condividono più lo stesso id.
  - `PlannerDropTarget` accetta `weekLabel` e `isReadOnly`, cresce (padding verticale maggiore, altezza minima ~96px, icona più grande, titolo + sottotitolo) e mantiene gli stati "in trascinamento" / "sopra il bersaglio".
- `src/pages/Calendar.tsx`
  - In `handleDragEnd`, il ramo che gestisce il rilascio nel planner accetta sia `PLANNER_DROPZONE_ID` sia `PLANNER_SURFACE_ID`, riusando `openPlanFromDrop` per task (con fallback già presente sull'attività ricavata dalla task) e attività.
  - Import aggiornato con il nuovo id.
- Nessuna modifica a database, RLS o mutazioni: cambia solo il riconoscimento del rilascio e la resa del riquadro.
