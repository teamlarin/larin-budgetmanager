# Calendario: due sole viste + vista predefinita

## Obiettivo

Ridurre il calendario a due visualizzazioni e permettere di scegliere quale usare all'apertura.

## Cosa cambia

1. **Rimozione della vista "Giorno"**
   - Il pulsante "Giorno" spariste dal selettore in alto.
   - Restano due pulsanti: **Giornaliera** (l'attuale griglia settimanale con gli orari) e **Planner** (l'attuale vista Pianificazione).
   - La navigazione avanti/indietro resta settimanale in entrambe le viste.

2. **Rinomina delle etichette**
   - "Settimana" → **Giornaliera**
   - "Pianificazione" → **Planner**
   - Nessun cambio nel funzionamento delle due viste.

3. **Vista predefinita nelle opzioni del calendario**
   - Nuova opzione nelle impostazioni del calendario: "Vista predefinita" con le due scelte Giornaliera / Planner.
   - La preferenza è salvata sul profilo dell'utente (come le altre impostazioni del calendario) e viene applicata ogni volta che si apre il calendario.
   - Se non è mai stata impostata, il default resta Giornaliera.

## Dettagli tecnici

- Migrazione database: aggiunta colonna `default_view` (testo, default `week`, valori ammessi `week` / `planning`) su `user_calendar_settings`.
- `src/hooks/useCalendarSettings.ts`: aggiunta di `defaultView` a `CalendarConfig`, mapping db↔config e nel default locale.
- `src/components/CalendarSettings.tsx`: nuovo select "Vista predefinita".
- `src/pages/Calendar.tsx`: `viewMode` diventa `'week' | 'planning'`; rimozione di `selectedDayDate` e di tutti i rami `viewMode === 'day'` (calcolo `weekDays`, navigazione, scorciatoie da tastiera, "oggi"); inizializzazione di `viewMode` da `config.defaultView` una volta caricate le impostazioni.
- `src/components/calendar/CalendarHeader.tsx`: toggle a due voci con le nuove etichette, rimozione della logica di navigazione giornaliera e del titolo dedicato al giorno.
- Verifica finale con typecheck e controllo che non restino riferimenti alla vista `day`.
