

## Fix: Progresso errato per progetti recurring nella card "In chiusura"

### Problema
I progetti recurring come "CDL - Marketing operativo 2026" mostrano il progresso grezzo (`p.progress`) invece del progresso calcolato in base all'avanzamento temporale. Lo stesso problema esiste nella dashboard Admin (`AdminOperationsDashboard`) dove e gia presente la funzione `getDisplayProgress` che calcola correttamente il progresso per i recurring.

### Soluzione

**`src/pages/Dashboard.tsx`** — team leader query (~riga 939-972):

1. Applicare la stessa logica di `getDisplayProgress` usata in `AdminOperationsDashboard`:
   - Per **recurring** con `start_date` e `end_date`: calcolare `(giorni trascorsi / giorni totali) * 100`
   - Per **pack**: usare `p.progress ?? 0`
   - Per **interno/consumptive**: escludere (non ha senso il progresso)
   - Per gli altri: usare `p.progress`

2. Filtrare `closingProjectsList` usando il progresso calcolato (`displayProgress >= 85`) invece di `p.progress >= 85`

3. Passare il `displayProgress` calcolato nel campo `progress` di ogni progetto nella lista, cosi il dialog mostra il valore corretto

Stessa correzione va applicata anche alla dashboard Admin in `Dashboard.tsx` (~riga 148) dove `criticalProjects` usa `p.progress` grezzo.

### File modificato
- `src/pages/Dashboard.tsx`

