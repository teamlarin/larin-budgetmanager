# Riferimento contrattuale: una sola pagina, letto ovunque

Oggi il contratto di una persona (ore e periodo di riferimento: giornaliero, settimanale, mensile) vive in due posti: il modulo di modifica utente e la finestra dei periodi contrattuali. Alcune viste leggono uno, altre l'altro, con calcoli scritti a mano in punti diversi: per questo la stessa persona può risultare con capacità diverse tra dashboard, carico di lavoro e calendario.

## Cosa cambia per l'utente

- **Un unico punto di aggiornamento**: in Impostazioni → Utenti ogni persona ha una scheda **Contratto** con tipo, ore, periodo di riferimento, tariffa e lo storico dei periodi (dal / al). Da lì si aggiunge, modifica o chiude un periodo.
- Il modulo di creazione/modifica utente non chiede più ore e periodo: alla creazione viene aperto un primo periodo contrattuale, poi si gestisce tutto dalla scheda Contratto.
- **I periodi diventano l'unica verità**: la capacità di ogni persona in una settimana o in un mese si calcola dal periodo contrattuale attivo in quelle date. Le ore "base" sul profilo restano solo come ripiego per chi non ha ancora nessun periodo.
- **Lettura uniforme**: La mia settimana, tab Team, Carico di lavoro, Calendario (ore giornaliere e settimanali di riferimento), banca ore del profilo, Costo personale e cruscotto team leader mostrano lo stesso valore.
- Le 8 persone attive oggi senza alcun periodo ne ricevono uno di partenza, creato dai valori già presenti sul loro profilo, senza data di fine.
- Chi vede la scheda Contratto: admin e finance possono modificare; team leader e la persona stessa la vedono in sola lettura.

## Dettagli tecnici

**Fonte unica di calcolo** — estendere `src/lib/contractPeriods.ts`:
- `getEffectiveContract` resta l'unico risolutore; aggiungere `contract_type` alla riga risolta e una variante `getEffectiveContractForDate(userId, date, ...)` per i calcoli mensili/giornalieri.
- nuovo hook `src/hooks/useContractResolver.ts`: carica in una query `get_profiles_compensation` + `user_contract_periods` per un set di utenti e restituisce `resolve(userId, from, to)` con `{ hours, period, contract_type, source: 'period' | 'profile' }`; cache React Query condivisa (`['contracts', ids]`).
- spostare in `src/lib/capacity.ts` le conversioni oggi duplicate (daily ×giorni lavorativi, weekly, monthly) come unica funzione `contractHoursForRange`.

**Punti da riportare sull'hook/helper** (rimuovendo i calcoli inline):
- `src/pages/Dashboard.tsx` (weeklyContractHours e monthlyContractHours, entrambi i blocchi ~330-470 e ~1200-1430; mappa profili ~830-980)
- `src/pages/Calendar.tsx` (~367-390)
- `src/components/dashboards/UserHoursSummary.tsx` (rimuovere la risoluzione locale ~360-420)
- `src/components/ProfileHoursBank.tsx` (`getContractDataForDate`, `isConsuntivo`/`isFreelance` dal periodo attivo)
- `src/components/dashboards/TeamLeaderDashboard.tsx` (~375)
- già allineati ma da far passare dall'hook: `src/pages/Workload.tsx`, `src/hooks/useTeamWeek.ts`, `src/components/dashboards/WorkloadSummaryWidget.tsx`
- `supabase/functions/send-weekly-team-hours-report/index.ts`: replicare la stessa risoluzione lato server.

**UI** — `src/components/UserManagement.tsx`:
- sostituire i campi `contract_hours` / `contract_hours_period` dello schema di modifica con un rimando alla scheda Contratto; alla creazione utente inserire un periodo iniziale in `user_contract_periods`.
- `UserContractPeriodsDialog.tsx` diventa la scheda Contratto: aggiungere il riepilogo del periodo attivo in testa, validazione delle sovrapposizioni e dei periodi senza fine (max uno aperto), e modalità sola lettura per team leader / se stessi.
- la colonna contratto in tabella mostra il periodo attivo con un'indicazione quando deriva dal ripiego di profilo.

**Dati**
- Backfill una volta sola (operazione sui dati, non sullo schema): per ogni profilo attivo senza periodi, creare un periodo con `start_date` = data inizio collaborazione (o `created_at`), `end_date` nullo, e ore/periodo/tipo/tariffa copiati dal profilo.
- Nessuna modifica di schema prevista; se la validazione "un solo periodo aperto" va imposta a livello di database, si aggiunge con un trigger di validazione dedicato.

**Verifica**
- estendere `src/test/capacity.test.ts` con casi: periodo attivo che vince sul profilo, periodo aperto, cambio di contratto a metà settimana, persona senza periodi (ripiego), tipo consuntivo.
- confronto manuale della stessa persona tra La mia settimana, tab Team, Carico di lavoro e Calendario nella stessa settimana.
