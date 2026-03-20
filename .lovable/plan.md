

## Filtrare i progetti "Senza aggiornamenti" nel WeeklyUpdatesWidget

### Problema
La query attuale conta **tutti** i progetti approvati con status `aperto` o `in_partenza`, inclusi:
- **Recurring** e **Pack**: hanno progresso automatico, non richiedono update manuali
- **Interno** e **Consumptive**: hanno progresso disabilitato (valore -1)
- **In partenza**: non hanno ancora iniziato operativamente

Questo gonfia il conteggio a 152, generando falsi positivi.

### Soluzione

**File: `src/components/dashboards/WeeklyUpdatesWidget.tsx`** — query `stale-projects-no-updates`

1. Aggiungere il campo `billing_type` alla select dei progetti
2. Filtrare solo `project_status = 'aperto'` (escludere `in_partenza`)
3. Escludere i progetti con `billing_type` in `['recurring', 'pack', 'interno', 'consumptive']` — sono progetti con progresso automatico o disabilitato che non necessitano di update manuali
4. Il conteggio e la lista mostreranno solo i progetti che effettivamente richiedono un aggiornamento manuale del progresso

### Dettaglio tecnico
- Nella query Supabase: `.eq('project_status', 'aperto')` invece di `.in('project_status', ['aperto', 'in_partenza'])`
- Dopo il fetch, filtrare client-side: `.filter(p => !['recurring', 'pack', 'interno', 'consumptive'].includes(p.billing_type))`
- Il `billing_type` va aggiunto alla select: `'id, name, area, billing_type, clients(name)'`

