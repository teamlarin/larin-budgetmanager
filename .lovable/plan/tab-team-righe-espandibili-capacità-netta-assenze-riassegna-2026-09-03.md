# Tab Team: righe espandibili, capacità netta assenze, riassegna

I primi due passi che indichi sono già in piedi: la dashboard personale è un'unica tab "La mia settimana" con focus unificato progetti+task, e `TeamLeaderDashboard` è già splittato in `roleTabs` ("Progetti" / "Team"). Quindi il lavoro qui è il terzo pezzo: rendere la tab Team una vista settimanale leggibile e onesta.

## Cosa cambia nella tab Team

Un solo blocco "Team — settimana" con navigatore `← settimana →` interno (default settimana corrente, pulsante "Oggi"), che sostituisce l'attuale coppia widget carico + riepilogo ore. Il filtro data globale della dashboard non influenza questa vista.

**Riga chiusa (una per persona)**
- Nome, ruolo/area/livello
- Barra unica con due tracce sovrapposte: pianificato e confermato sulla stessa capacità netta, così si vede subito chi pianifica poco e lavora molto (e viceversa)
- Ore libere = capacità netta − pianificato
- Numero task con scadenza dentro la settimana
- Badge "ore da confermare" se ha slot pianificati in giorni già passati senza orario effettivo
- Badge "assenza" con le ore di assenza della settimana, quando presenti

**Riga aperta**
- Griglia lun–ven con le ore per giorno, segmenti colorati per progetto (colori dai token esistenti), giorni di assenza marcati
- Sotto: ripartizione "progetto → ore settimana" (pianificate e confermate)
- A fianco: task con scadenza nella settimana, ordinate per scadenza, con stato e priorità
- Azione **Riassegna** su ogni task e su ogni riga progetto/slot: dialog con selezione della persona e conferma esplicita. Per la task cambia l'assegnatario; per uno slot di pianificazione cambia l'utente dell'entry di time tracking. Nessun drag & drop.

## Le due correttezze

**Capacità netta assenze.** Le assenze sono registrate come ore sul progetto speciale "Larin OFF" (voci Ferie, Permesso, Malattia, Visita medica, Banca ore, Donazione sangue). Oggi la capacità viene solo dal contratto, quindi chi è in ferie risulta libero. Nuova regola:

```text
capacità netta = capacità da contratto − ore assenza della settimana
pianificato/confermato = ore su tutti i progetti ESCLUSO "Larin OFF"
ore libere = max(0, capacità netta − pianificato)
utilizzo = pianificato / capacità netta
```

Le ore di assenza restano visibili come badge e nella griglia giornaliera, ma non gonfiano il carico.

**Pianificato vs confermato separati.** Oggi l'utilizzo medio è solo pianificato/capacità. Diventano due tracce nella stessa barra (nessuna card aggiuntiva), e i KPI di testa mostrano entrambe le medie: % pianificazione e % confermato su capacità netta.

## Dettagli tecnici

- Nuovo hook `src/hooks/useTeamWeek.ts`: una query per settimana che restituisce per utente `{ capacityGross, absenceHours, capacityNet, plannedHours, confirmedHours, unconfirmedPastHours, byDay[5], byProject[], tasks[] }`. Riusa `getEffectiveContract` (`src/lib/contractPeriods.ts`), `calculateSafeHours` (`src/lib/timeUtils.ts`), `fetchProfilesCompensationMap` e la paginazione a 1000 righe già usata in `WorkloadSummaryWidget`. Il progetto assenze è identificato via join `budget_items → projects` con nome che inizia per "Larin OFF" (costante centralizzata in `src/lib/constants.ts`), non con ID hardcodato.
- Task: query su `project_tasks` con `due_date` nella settimana e assegnatari da `project_task_assignees` (batch `.in()` ≤ 100), riusando l'ordinamento di `useMyTasks`.
- Nuovo componente `src/components/dashboards/TeamWeekView.tsx` (riga chiusa/aperta con `Collapsible`, barra a doppia traccia, griglia giorni, blocco progetti, blocco task) e `src/components/dashboards/ReassignDialog.tsx` (mutation su `project_tasks.assignee_id` + `project_task_assignees`, oppure `activity_time_tracking.user_id`, con invalidazione delle query settimanali).
- `src/pages/Dashboard.tsx`: nella tab `team` di admin e team leader si passa a `TeamWeekView` (con `filterUserIds` per il team leader). `UserHoursSummary` resta disponibile sotto, in un accordion "Andamento ore", per non perdere il dettaglio mensile.
- Le date usano `format(d, 'yyyy-MM-dd')`, mai `toISOString()`.
- Permessi già verificati: team leader e admin possono aggiornare `activity_time_tracking` di altri utenti e le task dei progetti a cui accedono; nessuna migrazione necessaria.
- `WorkloadSummaryWidget` e la pagina `/workload` restano invariate in questo giro; la capacità netta viene estratta in una funzione condivisa (`src/lib/capacity.ts`) così da poterla applicare anche lì in un secondo momento.
- Test unitari nuovi in `src/test/` per il calcolo capacità netta / ore libere / utilizzo con e senza assenze.
