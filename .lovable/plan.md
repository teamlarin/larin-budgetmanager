# Tab Progetti: quattro gruppi e una sola definizione di criticità

## Cosa cambia per chi la usa

La tab "Progetti" della dashboard smette di essere una fila di card con i dettagli nascosti dentro i dialog. Diventa una lista di lavoro divisa in quattro gruppi collassabili, ordinati per urgenza, con le colonne che servono per decidere. I dialog "In partenza" e "In chiusura" vengono rimossi: il loro contenuto diventa un gruppo della vista.

| Gruppo | Criterio | Colonne | Stato iniziale |
|---|---|---|---|
| A rischio | budget consumato > 85%, oppure margine residuo sotto il target, oppure proiezione di sforamento | budget %, margine (residuo vs target), ore residue, giorni alla deadline | aperto |
| In chiusura | `end_date` entro 30 giorni (e non già in "A rischio") | giorni alla deadline, progresso %, ore residue | aperto |
| In corso | resto dei progetti `aperto` | ultimo aggiornamento, budget %, leader | chiuso |
| In partenza | `project_status = in_partenza` | data inizio, team assegnato, ore pianificate | chiuso |

Ogni progetto compare in un solo gruppo (priorità dall'alto verso il basso). Ogni riga porta un badge con il motivo della criticità ("budget 92%", "margine -8 pt", "scade in 4gg") e apre il canvas al click. Le KPI card in cima restano, ma diventano scorciatoie che aprono/scrollano al gruppo corrispondente invece di aprire un dialog.

## Una sola definizione di criticità

Oggi tre punti del prodotto rispondono in modo diverso sullo stesso progetto: la pagina Progetti Approvati (deadline < 7gg, margine residuo ≤ target, progresso ≥ 85%), le notifiche progressive backend (50/75/90/100% budget) e il focus score personale. Introduciamo una sorgente unica lato front-end e la usiamo in tutte le viste.

Soglie unificate proposte:

- **Budget**: `warning` ≥ 75%, `critical` ≥ 90% di ore confermate su ore previste (oggi la dashboard usa 85% come soglia unica: 85% resta il limite di ingresso nel gruppo "A rischio", ma il colore segue warning/critical).
- **Margine**: `critical` se margine residuo < 0 oppure delta vs target < -10 punti; `warning` se delta in [-10, -5). Sono già le soglie di `classifyMargin` in `useTeamLeaderProjectMargins.ts`, quindi le promuoviamo a standard.
- **Deadline**: `critical` ≤ 3 giorni o scaduto; `warning` ≤ 7 giorni.
- **Proiezione**: `critical` se la proiezione a fine progetto supera il target oltre `projection_critical_threshold` (default 25%), `warning` oltre `projection_warning_threshold` (default 10%). I due campi esistono già su `projects`.
- **Esclusioni**: progetti con `area = 'interno'`, progetti a consuntivo e progetti senza budget non generano criticità economiche (solo deadline). È la regola già applicata in Progetti Approvati.

Il livello del progetto è il massimo tra i suoi segnali, con l'elenco dei motivi.

## Scoping per area

Verificato: la policy RLS `Role-based project visibility` concede la lettura di **tutti** i progetti a `admin`, `finance`, `team_leader`, `coordinator`, `account`; il filtro per area del team leader esiste solo lato client in `Dashboard.tsx` (`team_leader_areas` → `.in('area', assignedAreas)`).

Come concordato, RLS non viene toccata in questo intervento: una restrizione per area agirebbe su tutta la tabella e cambierebbe anche Progetti, Progetti Approvati, canvas ed export. Il filtro area resta lato client, applicato in un solo punto (l'hook di dati della tab) e documentato come scelta di prodotto, non come confine di sicurezza. L'hardening RLS resta un intervento separato da valutare.

## Dettagli tecnici

1. **Nuovo `src/hooks/useProjectCriticality.ts`**: funzioni pure (`evaluateProjectCriticality`, `classifyBudget`, `classifyDeadline`, `classifyProjection`) più un hook che unisce progetti + mappa margini da `useTeamLeaderProjectMargins` e restituisce `{ level, reasons[], budgetPct, marginDelta, daysToEnd, hoursRemaining }`. `classifyMargin` viene spostata qui e ri-esportata da `useTeamLeaderProjectMargins.ts` per compatibilità.
2. **Nuovo `src/components/dashboards/ProjectsGroupedView.tsx`**: i quattro gruppi con `Accordion` (shadcn), tabella per gruppo su desktop e card su mobile, badge dei motivi, contatori nell'header di ogni gruppo, skeleton in caricamento e stato vuoto per gruppo.
3. **`TeamLeaderDashboard.tsx`**: `TeamLeaderProjectsSection` monta `ProjectsGroupedView` al posto di `ProjectsNearDeadlineWidget` + i due dialog; i dialog "In partenza"/"In chiusura" e il relativo stato vengono rimossi. `TeamLeaderMarginOverview` resta sotto.
4. **`Dashboard.tsx`**: la query team leader espone anche i progetti `in_partenza` con team e ore pianificate già presenti, più `last_progress_update` (da `project_progress_updates`) per la colonna "ultimo aggiornamento" del gruppo In corso. Nessuna modifica al filtro area esistente.
5. **`ApprovedProjects.tsx`** e **`useWeeklyFocus.ts`**: sostituiscono i loro calcoli locali con `evaluateProjectCriticality`, così i tre punti dicono la stessa cosa. Il focus score continua a pesare i suoi bonus, ma prende i segnali dall'hook condiviso.
6. **Test**: nuovo file di test sulle funzioni pure di criticità (soglie, esclusioni, precedenza dei gruppi) accanto agli altri in `src/test/`.

Non toccato: notifiche backend (50/75/90/100%), che restano allineate come intervallo ma vivono in SQL; se si vuole allinearle anche lì serve una migrazione separata.
