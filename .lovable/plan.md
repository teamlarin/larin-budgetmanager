
## Obiettivo

Rendere il tab **"Progetti"** della dashboard personale davvero utile ai team leader, dando in un colpo d'occhio: scadenze imminenti dei progetti del proprio team, ultimi update settimanali, e marginalità economica dei progetti attivi (target vs proiettata).

Oggi il tab per il team leader (`TeamLeaderProjectsSection` in `src/components/dashboards/TeamLeaderDashboard.tsx`, montato da `src/pages/Dashboard.tsx` alle righe 1758-1784) mostra: 5 KPI cards, un box "Progetti a rischio scadenza (≤7g, <80%)", `ProjectsNearDeadlineWidget` (prossimi 14 giorni) e `WeeklyUpdatesWidget` filtrato per aree. Manca completamente la parte marginalità e la vista scadenze/update è statica.

## Cosa costruire

Riorganizzare la sezione in 4 blocchi verticali, tutti filtrati sulle aree assegnate al team leader:

### 1. KPI riga superiore (rivista)
Mantengo le 5 card esistenti (Progetti aperti, In partenza, Budget totale, Completati anno, In chiusura) e ne aggiungo 2 nuove sulla marginalità aggregata del team:
- **Margine medio target** — media pesata di `margin_percentage` dei progetti aperti dell'area.
- **Progetti sotto target** — numero di progetti aperti la cui marginalità proiettata è inferiore al target dichiarato (soglia > 5 punti sotto).

### 2. Scadenze imminenti (potenziata)
Espando `ProjectsNearDeadlineWidget` in una vista con tab/filtro:
- **Critici** (≤7g e progresso <80%)
- **Prossimi 14g**
- **Prossimi 30g**

Ogni riga mostra: nome progetto, cliente, area (badge colorato), giorni rimanenti, % progresso, e nuovo indicatore marginalità (▲ verde se ≥ target, ▼ rosso se < target, − se dati insufficienti). Click sulla riga porta al canvas del progetto.

### 3. Marginalità progetti (nuova sezione)
Nuovo componente `TeamLeaderMarginOverview` che:
- Invoca la edge function `calculate-project-margins` (già usata da `ApprovedProjects.tsx`) passando gli `id` dei progetti aperti dell'area del leader.
- Mostra una tabella compatta ordinabile con: nome progetto, cliente, budget totale, costi consuntivi, costi proiettati, margine target %, margine proiettato %, delta (evidenziato in rosso/giallo/verde).
- In cima, tre mini-card riassuntive: **Progetti in profitto**, **Progetti in warning** (delta -5%/-10%), **Progetti critici** (delta < -10% o margine proiettato < 0).
- Toggle "mostra solo critici" per filtrare rapidamente.
- Vista limitata a 10 righe con "Vedi tutti" che apre un `Dialog` con la lista completa.

### 4. Update settimanali (invariato)
Resta il `WeeklyUpdatesWidget` esistente, filtrato per le aree del leader.

## Note tecniche

- Riuso di `calculate-project-margins` (edge function esistente) → nessun cambio SQL/DB. La chiamata si fa client-side dopo aver raccolto gli id dei progetti visibili al leader, come già fa `ApprovedProjects.tsx`.
- Nuovo hook `useTeamLeaderProjectMargins(projectIds)` in `src/hooks/` che gestisce fetch, caching (`react-query`, staleTime 5 min) e mapping in `{ currentMargin, projectedMargin, targetMargin, deltaVsTarget, status }`.
- Il calcolo di "sotto target" e le soglie di warning/critical vivono nell'hook (soglie: warning `delta ∈ [-10, -5]`, critical `delta < -10 || projected < 0`).
- Nessuna modifica ai calcoli di costo/marginalità già esistenti — solo consumo.
- Modifiche mirate a:
  - `src/components/dashboards/TeamLeaderDashboard.tsx` (`TeamLeaderProjectsSection`: nuove KPI, riorganizzazione).
  - `src/components/dashboards/ProjectsNearDeadlineWidget.tsx` (aggiunta tab critici/14g/30g e badge marginalità).
  - Nuovi file: `src/hooks/useTeamLeaderProjectMargins.ts`, `src/components/dashboards/TeamLeaderMarginOverview.tsx`.
- Nessun cambiamento su RLS, tabelle o edge functions. Nessun impatto sugli altri ruoli (admin/account/finance/member continuano a usare le loro sezioni invariate).

## Fuori scope

- Non tocco il tab "Team" né "Il mio Recap"/"Focus Settimana".
- Nessuna modifica alla marginalità mostrata su pagine di dettaglio progetto (`ProjectBudgetStats`, `ProjectCanvas`).
- Nessuna esposizione di dati finanziari sensibili nuovi: il team leader ha già accesso a budget e costi dei progetti del proprio team.

## Domande aperte

Se preferisci un focus diverso posso adattare — ad esempio, sostituire la tabella marginalità con un grafico bar comparativo (target vs proiettato), o aggiungere alert automatici via notifica quando un progetto scende sotto soglia.
