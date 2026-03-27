

## Applicare le maggiorazioni a ore contabili, ore rimanenti e progresso pack (senza incidere su margine/consumo budget)

### Cosa cambia

Le maggiorazioni persistite in `project_timesheet_adjustments` devono influenzare **solo** le metriche basate sulle ore, non quelle economiche:

| Metrica | Impatto |
|---|---|
| Ore confermate (contabili) | SI — ore adjusted |
| Ore rimanenti da pianificare | SI — usa ore adjusted |
| Progresso % pack | SI — basato su ore adjusted / ore totali |
| Consumo budget (€) | NO — resta su ore grezze × tariffa |
| Margine residuo (€/%) | NO — resta su ore grezze × tariffa |
| Forecast / proiezione | NO — resta su costi grezzi |

### Modifiche

**1. `src/components/ProjectBudgetStats.tsx`**
- Aggiungere una query per caricare le maggiorazioni da `project_timesheet_adjustments` filtrate per `projectId`
- Calcolare le **ore confermate adjusted** (separate da `confirmedHours`): per ogni entry di time tracking, applicare `hours * (1 + (userAdj + categoryAdj) / 100)`
- Calcolare le **ore pianificate adjusted** con la stessa logica
- Usare le ore adjusted solo per:
  - "Ore rimanenti da pianificare": `calculatedTotalHours - adjustedPlannedHours`
  - Display "Ore confermate" (se si vuole mostrare il dato adjusted)
- **NON** toccare `confirmedCosts`, `totalSpent`, `consumptionPercentage`, `remainingPercentage` — restano calcolati sulle ore grezze

**2. `supabase/functions/calculate-project-margins/index.ts`**
- Fetch delle maggiorazioni da `project_timesheet_adjustments` per i progetti interessati
- Applicare le maggiorazioni **solo** al calcolo di `confirmedHours` (per il progresso pack: `confirmedHours / totalHours * 100`)
- **NON** applicare a `laborCost` — il costo resta su ore grezze
- Il margine residuo e il consumo budget non vengono toccati

### File modificati
- `src/components/ProjectBudgetStats.tsx`
- `supabase/functions/calculate-project-margins/index.ts`

