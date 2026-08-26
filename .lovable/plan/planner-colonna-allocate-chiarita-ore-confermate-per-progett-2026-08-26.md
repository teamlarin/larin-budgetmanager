# Planner: colonna "Allocate" chiarita + ore confermate per progetto

## Perché adesso sembra sbagliato

Nel riepilogo per progetto la colonna "Allocate" conta **solo le pianificazioni non ancora confermate** (tutte le settimane). Le ore della settimana che hai già confermato escono dal conteggio: per questo vedi righe con "Allocate 0m" ma "Settimana 2h 15m". Non è quindi che le ore della settimana siano escluse — sono escluse quelle confermate.

## Cosa cambia

Il riepilogo per progetto passa da 3 a 4 colonne:

- **Previste** — ore da budget delle attività del progetto assegnate a te (come oggi).
- **Pianificate** — ore pianificate e non ancora confermate, tutte le settimane (l'attuale "Allocate", rinominata per essere chiara).
- **Confermate** — ore già confermate da te su quel progetto (nuova colonna).
- **Settimana** — ore pianificate in questa settimana (come oggi).

La barra di avanzamento e l'evidenza rossa di sovra-allocazione usano **Pianificate + Confermate** rispetto a Previste, così il confronto col budget è corretto anche a settimane già chiuse.

La legenda sotto la tabella viene riscritta di conseguenza, spiegando che "Confermate" sono le tue ore consuntivate e "Settimana" è un sottoinsieme delle ore pianificate.

## Note tecniche

- `src/pages/Calendar.tsx`: nella query attività della sidebar il batch delle registrazioni confermate viene arricchito con `user_id`, così da costruire una seconda mappa "confermate dell'utente visualizzato" oltre a quella complessiva già usata. Nuovo campo `confirmed_hours_user` sull'oggetto attività (il `confirmed_hours` esistente resta invariato per non toccare la sidebar).
- `src/components/calendar/calendarTypes.ts`: aggiunta `confirmed_hours_user?: number` a `Activity`.
- `src/components/calendar/WeeklyPlanningView.tsx`: in `projectSummary` si somma `confirmedHours` per progetto; header, celle e legenda aggiornati; `coverage`/`overAllocated` calcolati su `allocatedHours + confirmedHours`.
- Nessuna modifica al database e nessun cambio di logica di pianificazione o salvataggio slot.
