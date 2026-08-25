# HR sotto Finanza, dashboard Finance rimossa

## Cosa cambia

1. **Nuova pagina "Costo personale"** dentro il menu **Finanza**, come ultima voce (dopo Abbonamenti). Contiene la vista HR oggi presente nel tab "HR" della dashboard. Visibile solo ai ruoli **admin** e **finance**, sia su desktop che su mobile.
2. **Tab "Finance" rimosso dalla dashboard**: sparisce sia dalla dashboard admin sia da quella del ruolo finance. Il ruolo finance mantiene la sua dashboard personale (attività, ore, task) e le informazioni finanziarie restano nelle pagine di Finanza.
3. **Tab "HR" rimosso dalla dashboard** (admin e finance), perché sostituito dalla nuova voce di menu.
4. **Widget "Siti WpZen"** spostato in fondo alla pagina **Abbonamenti**. Resta identico (ricerca, filtro etichette, elenco siti) e viene rimosso dalle dashboard.

## Dettagli tecnici

- Nuova pagina `src/pages/StaffCost.tsx` che rende `HrBudgetDashboard` con titolo "Costo personale" e guardia di ruolo (`admin`/`finance`, con redirect/messaggio per gli altri).
- Nuova rotta `/staff-cost` in `src/App.tsx` dentro `AppLayout`.
- `src/components/AppHeader.tsx`: nuova voce "Costo personale" (icona `Users`) come ultimo item del dropdown Finanza desktop e dello sheet mobile, condizionata a `isAdmin || effectiveRole === 'finance'`.
- `src/pages/Dashboard.tsx`: rimozione dei tab `finance` e `hr` per il ruolo admin; per il ruolo finance rimozione del tab Finance/HR mantenendo `UserHoursSummary` nella dashboard del ruolo, e pulizia degli import non più usati (`AdminFinanceDashboard`, `FinanceDashboard`, `HrBudgetDashboard`) e dei dati caricati solo per quei tab dove non più necessari.
- `src/pages/Subscriptions.tsx`: aggiunta `<KinstaSitesWidget />` come ultimo elemento della pagina.
- `AdminFinanceDashboard.tsx` e `FinanceDashboard.tsx` non più referenziati: vengono eliminati insieme al loro uso di `KinstaSitesWidget`.
- Le rotte esistenti (Cruscotto, Fatture, Abbonamenti, ecc.) non cambiano.
