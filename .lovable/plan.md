# Sidebar calendario: task in cima e completamento rapido

## Obiettivo
Nella sidebar del calendario le task da pianificare vengono mostrate sopra l'elenco delle attività assegnate, e ogni task può essere completata direttamente dalla sidebar (come già avviene per le attività).

## Cosa cambia
1. **Ordine sezioni**: "Task da pianificare" viene spostata sopra la ricerca/lista delle attività assegnate; le attività (e la sezione "Attività completate") restano sotto.
2. **Completamento task**: su ogni task compare un pulsante con la spunta. Al click la task passa a stato completato, spariscono dall'elenco (sono filtrate su stato aperto) e viene mostrato un toast di conferma con la possibilità di segnalare l'esito.
3. **Coerenza con la logica task esistente**: il completamento imposta `completed_at` e, se la task fa parte di una serie ricorrente, genera l'occorrenza successiva come già accade nel pannello task di progetto.
4. **Sola lettura**: se la sidebar è in modalità sola lettura (visualizzazione del calendario di un altro utente senza permessi di gestione), il pulsante di completamento è disabilitato.

## Dettagli tecnici
- `src/components/calendar/CalendarSidebar.tsx`: riordino dei blocchi in `CardContent` (sezione task prima del blocco ricerca/filtri attività); nuova prop `onCompleteTask`.
- `src/components/calendar/PlannableTasksSection.tsx`: propaga `onCompleteTask` a `DraggableTask`.
- `src/components/calendar/DraggableTask.tsx`: pulsante icona `CheckCircle` (ghost, piccolo) accanto alla maniglia di drag, con `stopPropagation` sul pointer down per non innescare il drag di `@dnd-kit`.
- `src/pages/Calendar.tsx`: nuova mutation che aggiorna `project_tasks` (`status: 'done'`, `completed_at: now`) tramite l'helper già usato per l'update task, invalidando `['calendar-plannable-tasks']` e le query task correlate; passata alla sidebar come `onCompleteTask`.
