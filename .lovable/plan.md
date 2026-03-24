

## Sostituire metriche nel widget "Carico di lavoro team"

### Obiettivo
Nelle 4 stat card del `WorkloadSummaryWidget`:
- **"Pianificate"** → **"% Pianificazione"**: percentuale media di utilizzo risorse (media delle `utilizationPercentage` di tutti gli utenti)
- **"Confermate"** → **"Ore libere"**: somma delle ore di capacità non ancora pianificate (`capacityHours - plannedHours`, minimo 0)

### Modifiche — `src/components/dashboards/WorkloadSummaryWidget.tsx`

1. **Calcolo nuove metriche** (dopo riga 132):
   - `avgPlanning`: media di `utilizationPercentage` di tutti gli utenti con `capacityHours > 0`
   - `totalFreeHours`: somma di `Math.max(0, u.capacityHours - u.plannedHours)` per tutti gli utenti

2. **Card "Pianificate" → "% Pianificazione"** (riga 198-201):
   - Mostrare `avgPlanning%` invece di `formatHours(totalPlanned)`
   - Label: "% Pianificazione"

3. **Card "Confermate" → "Ore libere"** (riga 202-205):
   - Mostrare `formatHours(totalFreeHours)` invece di `formatHours(totalConfirmed)`
   - Label: "Ore libere"

### File modificato
- `src/components/dashboards/WorkloadSummaryWidget.tsx`

