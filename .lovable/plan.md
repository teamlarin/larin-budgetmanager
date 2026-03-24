

## Sostituire TeamLeaderTeamSection con WorkloadSummaryWidget + UserHoursSummary

### Modifiche

**`src/components/dashboards/WorkloadSummaryWidget.tsx`**:
- Aggiungere prop opzionale `filterUserIds?: string[]`
- Se impostata, filtrare gli utenti nella query per includere solo quelli nella lista

**`src/pages/Dashboard.tsx`** (righe 1733-1742):
- Sostituire `<TeamLeaderTeamSection .../>` con:
  ```tsx
  <>
    <WorkloadSummaryWidget filterUserIds={teamLeaderData.teamMemberProfiles?.map((p: any) => p.id)} />
    <UserHoursSummary />
  </>
  ```
- Rimuovere `TeamLeaderTeamSection` dall'import

**`src/components/dashboards/TeamLeaderDashboard.tsx`**:
- Rimuovere il componente `TeamLeaderTeamSection` (non più usato)

### File modificati
- `src/components/dashboards/WorkloadSummaryWidget.tsx`
- `src/pages/Dashboard.tsx`
- `src/components/dashboards/TeamLeaderDashboard.tsx`

