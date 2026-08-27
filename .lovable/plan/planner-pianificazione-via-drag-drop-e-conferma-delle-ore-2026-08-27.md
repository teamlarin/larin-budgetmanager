# Planner: pianificazione via drag & drop e conferma delle ore

## Obiettivi

1. Nel Planner si può pianificare un'attività (o una task) trascinandola dalla sidebar, oltre che con il pulsante "Aggiungi attività".
2. Dal Planner si possono confermare le ore pianificate della settimana, slot per slot o in blocco.

## 1. Trascinamento dalla sidebar al Planner

- Il pannello del Planner diventa un'area di rilascio: quando trascini un'attività (o una task) dalla sidebar sopra il Planner, l'area si evidenzia.
- Al rilascio si apre la modale "Ore previste in settimana" già compilata con l'attività trascinata (e con la task collegata, se hai trascinato una task): indichi le ore e il sistema distribuisce automaticamente gli slot nei giorni liberi della settimana, come già avviene oggi con "Aggiungi attività".
- Se l'attività è già pianificata nella settimana, la modale parte dalle ore già presenti così il drop diventa una modifica invece di un doppione.
- Nessun rilascio possibile in modalità sola lettura (utenti esterni o visualizzazione del calendario di un altro utente).

## 2. Conferma dal Planner

- Ogni slot nell'elenco espanso avrà un pulsante di conferma (spunta): conferma le ore usando l'orario pianificato, esattamente come nella vista giornaliera. Gli slot già confermati mostrano un pulsante per annullare la conferma.
- A livello di riga attività: pulsante "Conferma ore" che conferma in blocco tutti gli slot non ancora confermati della settimana per quell'attività.
- In testa alla settimana: pulsante "Conferma slot passati" che conferma tutti gli slot della settimana la cui fine è già trascorsa (riusa la logica di conferma batch già esistente), con il conteggio degli slot interessati.
- Gli slot futuri restano confermabili solo singolarmente o dalla riga, con conferma esplicita, per evitare conferme accidentali di ore non ancora svolte.
- Dopo la conferma i totali del Planner (Pianificate totali / Pianificate settimana / Confermate settimana) e il riepilogo per progetto si aggiornano subito.

## Dettagli tecnici

- `src/components/calendar/WeeklyPlanningView.tsx`
  - `useDroppable({ id: 'planner-week-dropzone' })` sul contenitore, con stile di evidenziazione su `isOver`.
  - Nuove prop: `onConfirmSlot`, `onUnconfirmSlot`, `onConfirmRow(row)`, `onConfirmPastWeek()`, `confirmablePastCount`, e stato pending per disabilitare i pulsanti.
- `src/pages/Calendar.tsx`
  - In `handleDragEnd`: prima del controllo su `dropData.date`, gestire `over.id === 'planner-week-dropzone'`; ricavare `activity` o `task` da `active.data.current` e aprire `PlanActivityHoursDialog` con `fixedActivity` (e `initialTaskId` per le task), `initialMinutes` calcolati dagli slot già presenti in settimana per quel `budget_item_id`.
  - Nuovo stato `planDropActivity` per l'attività arrivata dal drop, passato come `fixedActivity` quando non c'è `planEditRow`.
  - Passare al Planner `confirmTrackingMutation`, `unconfirmTrackingMutation`, una conferma multipla che riusa `batchConfirmMutation` sugli slot della riga, e `confirmableTrackings` filtrati sulla settimana visibile.
- Nessuna modifica al database: la conferma continua a scrivere `actual_start_time`/`actual_end_time` con `createLocalISOString` sugli orari pianificati.
