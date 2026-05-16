# QA contrasto badge/stati in dark mode

## Stato attuale

Dopo l'attivazione del `ThemeProvider`, ho fatto un audit completo dei badge e indicatori di stato.

### Già OK (nessuna azione)
- **Helper centralizzati** `categoryColors.ts`, `areaColors.ts`, `disciplineColors.ts`: usano pattern `bg-X-500/10 text-X-700 dark:text-X-400 border-X-500/20` — leggibili in entrambe le modalità.
- **`ui/badge.tsx`** varianti vivaci (`bg-red-600 text-white`, ecc.): contrasto sufficiente in dark.
- **Calendar grid/sidebar**: ha già le coppie `dark:bg-red-950/30`.
- **Sonner/Toaster**: usa `next-themes` correttamente.

### Da correggere (badge/pillole con `bg-X-50/100` + `text-X-700/800` senza variante dark)

| Componente | Occorrenze | Cosa contiene |
|---|---|---|
| `src/components/dashboards/CronJobsMonitor.tsx` | 12 bg + 14 text | Pillole stato cron (success/error/running) |
| `src/components/ProjectBudgetStats.tsx` | 5 bg | Card riepilogo budget |
| `src/components/ProjectTimesheet.tsx` | 3 bg | Indicatori ore/stato |
| `src/components/ProjectProgressUpdates.tsx` | 2 bg | Card update progresso |
| `src/components/ProjectImport.tsx` | 2 bg | Stato righe import |
| `src/components/dashboards/MemberDashboard.tsx` | 2 bg | Card dashboard membro |
| `src/components/dashboards/TeamLeaderDashboard.tsx` | 1 bg | Card dashboard team leader |
| `src/components/dashboards/WorkloadSummaryWidget.tsx` | 1 bg | Riga riepilogo |
| `src/components/ActivityGanttChart.tsx` | 1 bg | Marker |
| `src/components/BudgetAuditLog.tsx` | 1 bg | Riga log |
| `src/components/ClientManagement.tsx` | 3 bg | Badge fonte cliente |
| `src/components/AiInsightsPanel.tsx` | 4 text | Testi colorati |
| `src/components/TimesheetImport.tsx` | 3 text | Indicatori esito riga |
| `src/pages/PublicTimesheet.tsx` | 2 text | Stati pubblici |
| `src/pages/ProjectBudget.tsx` | 2 text | Stato attività |

Totale: ~14 file, ~50 occorrenze.

## Piano

### 1. Normalizzare le pillole stato
Per ogni occorrenza `bg-X-50/100 text-X-700/800/900` aggiungere la coppia `dark:bg-X-900/30 dark:text-X-300` (o `/40` per tonalità più tenui). Quando il pattern è ripetuto inline più volte nello stesso file (es. CronJobsMonitor) estrarre una piccola mappa `STATUS_CLASSES` per evitare drift futuri.

### 2. CronJobsMonitor: refactor mini-mappa
Sostituire i 12 inline con un helper locale:
```ts
const STATUS = {
  success: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  error:   'bg-red-100   text-red-700   dark:bg-red-900/30   dark:text-red-300',
  running: 'bg-blue-100  text-blue-700  dark:bg-blue-900/30  dark:text-blue-300',
  idle:    'bg-muted     text-muted-foreground',
};
```

### 3. Testi puri colorati (AiInsightsPanel, TimesheetImport, PublicTimesheet, ProjectBudget)
Aggiungere `dark:text-X-300/400` accanto a ogni `text-X-700/800`.

### 4. StyleGuide
Aggiornare i sample mostrati così che riflettano i nuovi pattern dark-safe.

### 5. QA visivo
Per ognuna delle pagine principali, screenshot in light + dark a 1136 px:
- `/` Dashboard (admin + member/team_leader via role simulator)
- `/budgets` elenco progetti
- `/approved-projects`
- `/projects/:id` ProjectBudget + ProjectTimesheet + ProjectProgressUpdates
- `/projects/:id/canvas`
- `/quotes` + `/quotes/:id`
- `/calendar`
- `/workload`
- `/settings` (include CronJobsMonitor, ClientManagement, UserManagement)
- `/settings/system-monitor`
- `/notifications`, `/profile`, `/roles-documentation`, `/help`, `/style-guide`
- `*` (NotFound)

Per ogni screenshot dark verifico: leggibilità testo, contrasto badge AA (≥4.5:1 testo, ≥3:1 UI), assenza di "bianco su bianco" o pillole illeggibili.

### 6. Niente modifiche a
- `ui/badge.tsx` varianti vivaci (già OK).
- `categoryColors/areaColors/disciplineColors` (già OK).
- Calendar (già con coppia dark).

## Note tecniche
- Non introduco nuovi token in `index.css`: i colori semantici come muted/destructive sono già coperti; per i colori "informativi" (success/info/warning) preferisco mantenere le palette tailwind con coppia chiaro/scuro per non rompere lo style guide esistente.
- Nessuna modifica a business logic, RLS, edge functions o schema.

Confermami se procedo con **tutti i 14 file + QA visivo**, oppure se vuoi limitare la prima passata ai 3 più visibili (CronJobsMonitor, ProjectBudgetStats, ProjectTimesheet) e poi iterare.
