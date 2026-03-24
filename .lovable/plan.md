

## Suddividere la tab Operations in "Progetti" e "Team"

### Obiettivo
Separare la tab "Operations" della dashboard Admin in due tab distinte: **"Progetti"** (card statistiche, progetti critici, aggiornamenti settimanali) e **"Team"** (WorkloadSummaryWidget + UserHoursSummary).

### Modifiche

**`src/pages/Dashboard.tsx`** — `roleTabs` per admin:

Sostituire la singola tab `operations` con due tab:
1. **"Progetti"** (`value: 'progetti'`): contiene `<AdminOperationsDashboard .../>` (che già include le sezioni Progetti, Aggiornamenti Settimanali)
2. **"Team"** (`value: 'team'`): contiene `<UserHoursSummary />`

**`src/components/dashboards/AdminOperationsDashboard.tsx`**:

Rimuovere la sezione "Team" (il `<WorkloadSummaryWidget />` con il suo header) dal componente, dato che ora andrà nella tab dedicata.

**`src/pages/Dashboard.tsx`** — tab Team:

Il contenuto della tab Team sarà:
```tsx
<>
  <WorkloadSummaryWidget />
  <UserHoursSummary />
</>
```

### File modificati
- `src/pages/Dashboard.tsx` — roleTabs da 1 operations a 2 (progetti + team)
- `src/components/dashboards/AdminOperationsDashboard.tsx` — rimuovere sezione Team

