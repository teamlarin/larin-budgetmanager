# Verifica dark mode – stato attuale

Ho ispezionato l'intero codebase. La dark mode **non è realmente supportata**, nonostante l'infrastruttura CSS sia presente.

## Cosa funziona
- `tailwind.config.ts` ha `darkMode: ["class"]`.
- `src/index.css` definisce un set completo di token `.dark` (background, foreground, card, sidebar, gradients, shadows…).
- `next-themes` è già installato (usato solo da `sonner.tsx`).

## Cosa non funziona
1. **Nessun `ThemeProvider`**: `App.tsx`/`main.tsx` non avvolgono l'app con `next-themes`. La classe `.dark` non viene mai applicata a `<html>`, quindi i token dark non si attivano mai (nemmeno via system preference).
2. **Nessun toggle UI**: non esiste un selettore tema in header/sidebar/profilo.
3. **Colori hard-coded senza variante `dark:`** (5 file critici, 18+ occorrenze):
   - `src/pages/NotFound.tsx` – `bg-gray-100`, `text-gray-*`
   - `src/pages/ApprovedProjects.tsx` – `bg-white`, `text-gray-*`
   - `src/components/ui/badge.tsx` – varianti badge con `bg-white`/`text-black` fissi
   - `src/components/docs/RolesPermissionsSection.tsx`
   - `src/components/dashboards/HrBudgetDashboard.tsx`
4. **Uso di colori tailwind grezzi** (anche dove esiste `dark:` variant) invece dei token semantici, in particolare nei calendar component (`CalendarGrid`, `CalendarSidebar`, `DraggableActivity`, `ScheduledActivity`) e nei badge di stato (`BudgetStatusBadge`, `BudgetSummaryCard`, `ActivityGanttChart`, `ProjectProgressUpdates`). Funzionano in dark perché hanno doppia variante, ma non rispettano il design system.
5. `categoryColors.ts` e `areaColors.ts` restituiscono classi tailwind con tinte fisse: leggibili in entrambe le modalità ma non token-driven.

## Piano di intervento

### 1. Abilitare il tema (obbligatorio)
- Avvolgere l'app in `<ThemeProvider attribute="class" defaultTheme="system" enableSystem>` in `src/App.tsx`.
- Aggiungere un componente `ThemeToggle` (Sun/Moon dropdown light/dark/system) e montarlo nell'header principale (`AppLayout`/topbar).
- Persistere la scelta su `localStorage` (gestito da next-themes).

### 2. Fix colori hard-coded (5 file)
- `NotFound.tsx`, `ApprovedProjects.tsx`, `RolesPermissionsSection.tsx`, `HrBudgetDashboard.tsx`: sostituire `bg-white` → `bg-card`, `bg-gray-50/100` → `bg-muted`, `text-gray-600/700/900` → `text-muted-foreground`/`text-foreground`.
- `ui/badge.tsx`: rivedere le varianti custom usando token (`bg-secondary`, `bg-destructive`, ecc.) o aggiungere coppia `dark:`.

### 3. QA visivo
- Smoke test in entrambe le modalità delle pagine principali: Dashboard, Calendar, Workload, Projects, ProjectCanvas, Quotes, Budgets, HR Dashboard, Approved Projects, User Management, Docs, Auth, NotFound.

### 4. (Opzionale, non in questo task) Refactor token semantici
- Sostituire progressivamente le coppie `bg-red-50 dark:bg-red-950/30` con token `bg-destructive/10`, ecc. nei calendar e nei badge — non rompe nulla ma uniforma il design system.

## Note tecniche
- `next-themes` v0.3 è già in `package.json`, nessuna install necessaria.
- `ThemeProvider` deve stare il più in alto possibile, prima di `TooltipProvider` e `Toaster`, così `sonner.tsx` riceve correttamente `theme`.
- Aggiungere `suppressHydrationWarning` su `<html>` in `index.html` per evitare flash (next-themes lo richiede).

Confermami se procedo con **(1) + (2) + (3)** in un'unica passata, oppure se vuoi limitarti all'abilitazione del tema (1) e rinviare i fix cromatici.
