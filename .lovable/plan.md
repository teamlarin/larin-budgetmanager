

## Modifiche alla sezione "Progetti" della dashboard Team Leader

### Obiettivo
1. Sostituire la card "Da fatturare" con l'importo totale dei progetti completati nell'anno corrente
2. Aggiungere dialog di dettaglio cliccando sulle card "In chiusura" e "In partenza"

### Modifiche

**`src/pages/Dashboard.tsx`** — query team leader (~riga 792):
- Aggiungere una query per i progetti `completato` dell'anno corrente, filtrati per le aree del team leader:
  ```
  projects.status = 'approvato' AND project_status = 'completato' AND area IN assignedAreas
  AND updated_at >= '2026-01-01'
  ```
- Calcolare la somma dei `total_budget` di questi progetti → `completedYearRevenue`
- Passare anche la lista dei progetti `in_partenza` e `closingProjects` (>=85%) come dati separati al componente

**`src/pages/Dashboard.tsx`** — stats del team leader:
- Sostituire `projectsToInvoice` con `completedYearRevenue: number` e aggiungere `startingProjectsList` e `closingProjectsList` nei dati restituiti

**`src/components/dashboards/TeamLeaderDashboard.tsx`** — `TeamLeaderProjectsSection`:
1. **Card "Da fatturare" → "Completati anno"**: mostrare `formatCurrency(completedYearRevenue)` con subtitle "budget completati {anno}"
2. **Card "In partenza"**: aggiungere `onClick` che apre un dialog con la lista dei progetti in partenza (nome, cliente, data inizio)
3. **Card "In chiusura"**: aggiungere `onClick` che apre un dialog con la lista dei progetti in chiusura (nome, cliente, progresso %)
4. Aggiungere stato per i due dialog (`showStartingDialog`, `showClosingDialog`)
5. Usare `Dialog` con tabella semplice per entrambi

### Interfaccia aggiornata
```
stats: {
  ...
  completedYearRevenue: number;  // sostituisce projectsToInvoice
}
// + nuove props:
startingProjectsList: Project[];
closingProjectsList: Project[];
```

### File modificati
- `src/pages/Dashboard.tsx`
- `src/components/dashboards/TeamLeaderDashboard.tsx`

