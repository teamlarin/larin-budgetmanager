# Planner: nessun progetto selezionabile in "Aggiungi attività"

## Causa

Il dialog del Planner costruisce la lista progetti **solo dalle attività assegnate all'utente** (`budget_items.assignee_id`). Il tuo profilo (Alessandro Vettoruzzo) ha 0 attività assegnate, quindi il menu "Progetto" risulta vuoto. Lo stesso vale per gli altri utenti senza attività assegnate — sono la maggior parte in database.

Il dialog "Nuova attività manuale" del calendario non ha questo problema perché carica i progetti dal database (progetti aperti dove sei leader o membro) e poi tutte le attività di quel progetto.

## Cosa cambio

1. Nel dialog di pianificazione ore settimanali il menu "Progetto" elenca i **progetti aperti in cui sei project leader o membro del team** (stessa logica del dialog "Nuova attività manuale"), non più solo quelli con attività già assegnate a te.
2. Selezionato il progetto, il menu "Attività" mostra **tutte le attività del progetto** (escluse prodotti e categoria "import"), con evidenza di quelle già assegnate a te.
3. Resta la ricerca progetto, il campo ore/minuti e la distribuzione automatica sugli slot: nessun cambio nella logica di allocazione né nei controlli anti-sovrapposizione.
4. In modalità modifica ore (riga già pianificata) nulla cambia: l'attività resta fissa.
5. Se non risultano progetti (utente senza progetti aperti) compare un messaggio esplicito invece di una lista vuota silenziosa.

## Note tecniche

- `src/components/calendar/PlanActivityHoursDialog.tsx`: rimuovo la derivazione dei progetti da `activities`; aggiungo due query React Query analoghe a `CreateManualActivityDialog.tsx` (`projects` con `project_status = 'aperto'` filtrati per `project_leader_id` o `project_members`, e `budget_items` del progetto selezionato con `is_product` false). L'utente di riferimento è quello del calendario visualizzato (`viewingUserId`), quindi lo passo come prop da `Calendar.tsx`.
- `src/pages/Calendar.tsx`: passo `viewingUserId` al dialog; `activities` resta usato solo per risolvere `fixedActivity` in modifica.
- Nessuna modifica al database e nessuna modifica alle mutazioni di pianificazione.
