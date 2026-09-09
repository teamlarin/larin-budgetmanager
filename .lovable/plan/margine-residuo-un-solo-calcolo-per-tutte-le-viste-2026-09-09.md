# Margine residuo: un solo calcolo per tutte le viste

## Cosa non torna oggi

Il margine residuo viene calcolato in tre punti diversi, con dati diversi. Per lo stesso progetto i numeri non possono coincidere:

| Dove | Budget di riferimento | Costo del lavoro | Costi esterni |
|---|---|---|---|
| Lista progetti (Progetti) | budget attività (valore manuale, altrimenti somma attività non-prodotto) | tariffa **valida alla data** della registrazione | costi aggiuntivi del progetto |
| Scheda progetto (KPI + statistiche budget) | uguale alla lista | tariffa **attuale** della persona | costi aggiuntivi del progetto |
| Lista budget | budget totale di vendita | tariffa attuale della persona | prodotti (al netto IVA) |

Le due differenze verificate sui dati reali:

1. **Tariffe.** Molte persone hanno una tariffa storica diversa da quella attuale: Michele Da Rold 23 nei periodi contrattuali contro 80 sul profilo, Federico Bagato 28/32 contro 42, Giulia Sordi 21→25, Francesco Ferrari 25→27. La lista usa la tariffa del periodo, la scheda quella corrente: da qui gli scostamenti che vedi.
2. **Lista budget.** Divide per il budget di vendita e conta i prodotti invece dei costi aggiuntivi: è una terza formula, non confrontabile con le altre due.

Inoltre, quando il calcolo centralizzato non risponde, la lista mostra **100%** invece di segnalare che il dato non è disponibile: un progetto in perdita può apparire perfettamente sano.

Sul progetto di esempio (Meccanostampi - Fiera Fakuma) 1.590 € di attività, 1.500 € di budget attività impostato a mano e 44 registrazioni di tempo: la lista usa 1.500, la lista budget 1.725. Anche solo per questo i due numeri divergono.

## Cosa cambia

Un solo calcolo, usato da tutte e tre le viste, con la regola già in uso nella lista progetti (quella corretta contabilmente):

- budget di riferimento: il budget attività impostato a mano, altrimenti la somma delle attività non-prodotto;
- costo del lavoro: ore registrate per la tariffa **valida alla data della registrazione**, più costi generali;
- costi esterni: i costi aggiuntivi del progetto;
- margine residuo = (budget attività − costo del lavoro − costi esterni) / budget attività.

Effetti visibili:

- il valore nella lista Progetti e quello nella scheda del progetto coincidono sempre;
- la lista budget mostra lo stesso margine della scheda, non più una stima diversa;
- nella scheda progetto le voci "consumato", "rimanente al target" e la barra di consumo usano le tariffe storiche, quindi restano coerenti con il margine;
- se il calcolo non è disponibile la colonna mostra "—" con un avviso, non più 100%.

Nessun cambio di permessi: chi vede un progetto oggi vedrà gli stessi numeri di prima, solo corretti.

## Dettagli tecnici

1. **Nuova funzione di database `get_contract_rate_periods_for_costing(_user_ids uuid[])`** (`SECURITY DEFINER`, `search_path = public`, `EXECUTE` solo a `authenticated`, riservata agli utenti approvati non-`external`, come `get_hourly_rates_for_costing`): ritorna `user_id, start_date, end_date, hourly_rate` dai periodi contrattuali, con fallback su `profiles.hourly_rate` quando la persona non ha periodi. Serve perché la RLS su `user_contract_periods` non permette a tutti la lettura incrociata.
2. **Nuovo `src/lib/marginCalculation.ts`**: funzioni pure condivise — `buildRateResolver(periods)` (tariffa alla data, con fallback profilo), `computeLaborCost(entries, resolver, overheads)` con `calculateSafeHours` e cap orario già in uso, `computeResidualMargin({ activitiesBudget, laborCost, externalCost, marginPercentage })` che ritorna `{ residualMargin, targetBudget, totalSpent, remainingToTarget }`. Include il caso `activitiesBudget = 0` (nessun costo → nessun margine calcolabile, costi presenti → −100%), identico all'edge function.
3. **`supabase/functions/calculate-project-margins/index.ts`**: resta la sorgente per le viste aggregate; la formula viene allineata al nuovo modulo (stessa gestione dei casi limite) e si rimuove il blocco `[MARGIN DEBUG]` che oggi logga ogni progetto sotto il 20%.
4. **`src/pages/ProjectCanvas.tsx`**: `marginData` usa `get_contract_rate_periods_for_costing` + `marginCalculation`; l'invocazione per Slack legge `marginsResponse.margins[project.id]` (oggi legge `marginsResponse[project.id]`, quindi il margine nella notifica è sempre vuoto).
5. **`src/components/ProjectBudgetStats.tsx`**: sostituisce `userHourlyRates` (tariffa corrente) con il resolver per data; consumo, rimanente e proiezione derivano dallo stesso `computeResidualMargin`.
6. **`src/pages/Index.tsx`** (lista budget): elimina il calcolo locale su budget di vendita e prodotti; recupera i margini con lo stesso hook della lista progetti (`useTeamLeaderProjectMargins`) per i budget collegati a un progetto, e mostra "—" per i budget senza progetto.
7. **`src/pages/ApprovedProjects.tsx`**: `residualMargin` non ha più il fallback `?? 100`; diventa `null` con cella "—", tooltip "dato non disponibile" e ordinamento che spinge i valori mancanti in fondo. Stesso trattamento in `ProjectsGroupedView.tsx` e `TeamLeaderMarginOverview.tsx`, dove il margine mancante non deve produrre un falso "sano".
8. **Test**: nuovo `src/test/margin-calculation.test.ts` su tariffe multi-periodo, ore a cavallo di mezzanotte, budget attività manuale, budget zero e costi esterni; aggiornamento di `src/test/project-criticality.test.ts` per il margine assente.

Non toccato: RLS dei progetti, notifiche di soglia budget in SQL, calcolo del progresso dei progetti pack.
