# Planner: riepilogo per progetto con 3 colonne

## Obiettivo

Ridurre la tabella "Riepilogo per progetto" nel planner settimanale a **tre colonne**:

1. **Pianificate totali** — ore pianificate e non ancora confermate su tutte le settimane.
2. **Pianificate settimana** — ore pianificate e non ancora confermate nella settimana visualizzata.
3. **Confermate settimana** — ore già confermate (actual_start/end) con `scheduled_date` nella settimana visualizzata.

La colonna "Previste" viene rimossa dalla riga di riepilogo. La colonna "Confermate" (totali) aggiunta in precedenza viene rimossa.

## Comportamento

- La barra di avanzamento e l'evidenza rossa di sovra-allocazione continuano a confrontare **Pianificate totali + Confermate totali** con le ore previste del budget. Le ore previste restano nel calcolo ma non compaiono come colonna.
- "Pianificate settimana" è un sotto-insieme di "Pianificate totali".
- "Confermate settimana" è indipendente dalle pianificate.
- La legenda sotto la tabella viene riscritta per riflettere le tre colonne e il criterio della barra.

## Modifiche tecniche

### `src/components/calendar/WeeklyPlanningView.tsx`

- Rimuovere la colonna "Previste" dall'header e dalle celle del riepilogo per progetto.
- Rinominare la colonna "Pianificate" in "Pianificate totali" (`allocatedHours`).
- Rinominare la colonna "Settimana" in "Pianificate settimana": calcolata come `(plannedMinutes - confirmedMinutes) / 60` per progetto, usando gli slot della settimana corrente.
- Aggiungere la colonna "Confermate settimana": calcolata come `confirmedMinutes / 60` per progetto, usando gli slot della settimana corrente.
- Aggiornare il layout da 5 a 4 colonne (`grid-cols-[1fr_auto_auto_auto]`).
- Mantenere `budgetHours` nello stato interno per calcolare `coverage` e `overAllocated`.
- Mantenere `confirmedHours` come `confirmed_hours_user` dell'utente visualizzato, usato solo per la barra di avanzamento (Pianificate totali + Confermate totali vs Previste).
- Aggiornare anche il branch "Projects with week plans but no matching activity" per includere `confirmedWeekHours` calcolato dai `rows`.
- Rivedere il testo della legenda in fondo alla card.

### `src/components/calendar/calendarTypes.ts`

- Nessuna modifica: `confirmed_hours_user` rimane necessario per il calcolo della barra.

### `src/pages/Calendar.tsx`

- Nessuna modifica: la query attività e la mappa `confirmed_hours_user` sono già disponibili.

## Verifica

- `npx tsgo --noEmit -p tsconfig.app.json` per typecheck.
- Build del progetto.
- Verifica visiva nel planner: la tabella mostra esattamente le tre colonne richieste e i totali sono coerenti con gli slot della settimana.
