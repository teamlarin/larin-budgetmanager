# Task assegnate visibili nella sidebar del calendario

## Cosa succede oggi

La sidebar mostra la sezione "Task da pianificare" solo quando trova task che soddisfano tutte queste condizioni contemporaneamente:

- la persona è indicata come assegnatario principale della task (gli assegnatari aggiuntivi vengono ignorati);
- lo stato della task è "Da fare" o "In corso" — le task in **Backlog** (che ora è lo stato predefinito alla creazione) e quelle **Bloccate** non compaiono mai;
- l'attività collegata alla task è già presente nell'elenco delle attività della persona nel calendario; se non c'è, la task viene scartata in silenzio.

Per Alessandro Vettoruzzo ci sono 3 task collegate a un'attività: una completata, una in Backlog e una "Da fare". Con le regole attuali resta al massimo una task, e le task in Backlog non arriveranno mai in sidebar — motivo per cui la sezione risulta vuota o assente.

## Cosa cambia

1. **Escludere le task in Backlog**: in sidebar si vedono solo task "Da fare", "In corso" e "Bloccate" — Backlog e Completato restano fuori.
2. **Considerare tutti gli assegnatari**: una task compare anche a chi è assegnatario aggiuntivo, non solo al principale.
3. **Non scartare le task per attività mancante**: il nome dell'attività e del progetto vengono letti direttamente dalla task, così ogni task collegata a un'attività resta pianificabile.
4. **Sezione sempre presente**: se non ci sono task da pianificare, la sezione mostra un messaggio "Nessuna task da pianificare" invece di scomparire, così è chiaro che il filtro non è rotto.
5. **Verifica in anteprima** dopo la modifica, controllando che le task aperte di Alessandro compaiano e siano trascinabili sul calendario.

## Nota tecnica

- `src/pages/Calendar.tsx`: query `calendar-plannable-tasks` → stati `['todo','in_progress','blocked']`; recupero task anche via `project_task_assignees` (unione degli id con quelle su `assignee_id`, deduplicate); select estesa con il join `budget_items(id, activity_name, project_id, projects(name))` per ricavare nomi senza dipendere da `activities`; il `useMemo` non filtra più le task senza corrispondenza in `activities`.
- `src/components/calendar/DraggableTask.tsx`: `PlannableTask['status']` accetta i nuovi stati; badge/colore stato coerente con i token già usati per gli stati task.
- `src/components/calendar/CalendarSidebar.tsx`: rendere sempre `PlannableTasksSection`; `PlannableTasksSection` gestisce l'elenco vuoto.
- Nessuna migrazione, nessuna modifica alle RLS.
