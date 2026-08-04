# Pianificazione settimanale nel calendario

Aggiungiamo al calendario una terza modalità di visualizzazione — **Pianificazione** — accanto a "Settimana" e "Giorno". Serve a pianificare velocemente il carico di lavoro: si scelgono le attività dei progetti e si indica quante ore sono previste in quella settimana, senza dover disegnare gli orari giorno per giorno.

## Come funziona

1. Nell'header del calendario il selettore vista diventa: Settimana | Giorno | **Pianificazione**.
2. In modalità Pianificazione si vede una **colonna unica per la settimana corrente** (con le stesse frecce avanti/indietro e "Oggi" già presenti).
3. La colonna elenca le attività già pianificate in quella settimana, raggruppate per progetto, ognuna con il totale ore previste della settimana.
4. Un pulsante "Aggiungi attività" apre un pannello dove si sceglie il progetto, l'attività (dalle attività assegnate all'utente, le stesse della sidebar) e le ore previste (in ore/minuti).
5. Alla conferma le ore vengono **distribuite automaticamente sui giorni lavorativi della settimana** con orari reali:
   - si parte dal primo giorno utile della settimana (da oggi in poi se la settimana è quella corrente),
   - si salta weekend (se nascosti nelle impostazioni) e giorni di chiusura aziendale,
   - all'interno di ogni giorno lo slot viene accodato dopo gli impegni già presenti, rispettando l'orario di inizio/fine giornata delle impostazioni,
   - se un giorno è pieno si passa al successivo; le ore che non trovano capienza nella settimana vengono segnalate con un avviso.
6. Le attività così create sono normali registrazioni: compaiono nella vista Settimana/Giorno, si possono spostare, modificare, confermare ed eliminare come sempre.
7. Nella vista Pianificazione si possono anche modificare le ore previste di una riga (ricalcolo degli slot della settimana per quell'attività) o rimuoverla (elimina le registrazioni non confermate della settimana; le ore già confermate restano e vengono indicate).
8. In testa alla colonna: ore pianificate della settimana, ore contratto e residuo, così si vede subito se la settimana è sovraccarica.

## Note tecniche

- `viewMode` in `src/pages/Calendar.tsx` passa da `'week' | 'day'` a `'week' | 'day' | 'planning'`; `CalendarHeader` aggiorna il toggle e la label del periodo.
- Nuovo componente `src/components/calendar/WeeklyPlanningView.tsx` (lista raggruppata + riepilogo) e `src/components/calendar/PlanActivityHoursDialog.tsx` (scelta attività + ore).
- Nuovo helper `src/components/calendar/planningUtils.ts` con la funzione di distribuzione: input = ore totali, giorni della settimana ammessi, `config.workDayStart/workDayEnd`, giorni di chiusura (`useClosureDays`) e trackings esistenti; output = elenco di slot `{ scheduled_date, scheduled_start_time, scheduled_end_time }` + ore non allocate.
- L'inserimento riusa `scheduleActivityMutation` esistente (nessuna modifica al database: `activity_time_tracking` è già adeguata), con una insert multipla per gli slot generati e invalidazione delle stesse query key già in uso.
- Date sempre formattate con `format(date, 'yyyy-MM-dd')`; nessun `toISOString()`.
- La vista è disponibile agli stessi ruoli che possono già modificare il calendario proprio o altrui; per gli utenti `external` resta in sola lettura.
