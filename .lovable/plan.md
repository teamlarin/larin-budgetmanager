

## Fix: allineare progress_value dell'ultimo update al progresso calcolato

### Problema
Molti progetti recurring hanno l'ultimo record in `project_progress_updates` con `progress_value: 100` (o altri valori errati), mentre il progresso reale dovrebbe essere calcolato dall'avanzamento temporale. Ad esempio:
- **Bortoluzzi - Marketing Operativo 2026**: update mostra 100%, dovrebbe essere ~23%
- **Fondo Pegaso - Social Media Marketing 2026**: update mostra 100%, dovrebbe essere ~23%
- **Strategie Organizzative**: update mostra 100%, dovrebbe essere ~23%

### Soluzione
Creare una **migration SQL** che aggiorna il `progress_value` dell'ultimo record di ogni progetto recurring/pack/consumptive, allineandolo al valore corretto:

- **Recurring**: calcolo temporale `LEAST(100, GREATEST(0, ROUND(EXTRACT(EPOCH FROM (NOW() - start_date)) / EXTRACT(EPOCH FROM (end_date - start_date)) * 100)))`
- **Pack**: mantiene il valore attuale di `projects.progress` (calcolato dal backend sulle ore)
- **Consumptive/Interno**: imposta a 0

### Migrazione

**`supabase/migrations/fix_auto_progress_updates.sql`**:

```sql
-- Fix recurring projects: set last update's progress_value to temporal progress
UPDATE project_progress_updates ppu
SET progress_value = LEAST(100, GREATEST(0, ROUND(
  EXTRACT(EPOCH FROM (NOW() - p.start_date)) / 
  NULLIF(EXTRACT(EPOCH FROM (p.end_date - p.start_date)), 0) * 100
)))::int
FROM projects p
WHERE ppu.project_id = p.id
  AND p.billing_type = 'recurring'
  AND p.start_date IS NOT NULL
  AND p.end_date IS NOT NULL
  AND ppu.id IN (
    SELECT DISTINCT ON (project_id) id 
    FROM project_progress_updates 
    ORDER BY project_id, created_at DESC
  );

-- Fix consumptive/interno: set to 0
UPDATE project_progress_updates ppu
SET progress_value = 0
FROM projects p
WHERE ppu.project_id = p.id
  AND p.billing_type IN ('consumptive', 'interno')
  AND ppu.id IN (
    SELECT DISTINCT ON (project_id) id 
    FROM project_progress_updates 
    ORDER BY project_id, created_at DESC
  );

-- Fix recurring projects.progress field too (clean up wrong DB values)
UPDATE projects
SET progress = LEAST(100, GREATEST(0, ROUND(
  EXTRACT(EPOCH FROM (NOW() - start_date)) / 
  NULLIF(EXTRACT(EPOCH FROM (end_date - start_date)), 0) * 100
)))::int
WHERE billing_type = 'recurring'
  AND start_date IS NOT NULL
  AND end_date IS NOT NULL;
```

### File modificati
- Nuova migration: `supabase/migrations/[timestamp]_fix_auto_progress_updates.sql`

