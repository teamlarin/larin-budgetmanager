

## Persistere le maggiorazioni del timesheet nel database

### Problema
Le maggiorazioni percentuali (per utente e per categoria) sono salvate solo nello state React. Al refresh della pagina vanno perse.

### Soluzione

**1. Nuova migrazione SQL** — Tabella `project_timesheet_adjustments`:
```sql
CREATE TABLE public.project_timesheet_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  adjustment_type text NOT NULL CHECK (adjustment_type IN ('user', 'category')),
  target_id text NOT NULL,
  percentage numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (project_id, adjustment_type, target_id)
);
ALTER TABLE project_timesheet_adjustments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage adjustments"
  ON project_timesheet_adjustments FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
```

**2. `src/components/ProjectTimesheet.tsx`**:
- Aggiungere una `useQuery` per caricare le maggiorazioni dal DB all'avvio, filtrate per `projectId`
- Inizializzare lo state `adjustments` dai dati caricati (con `useEffect` che sincronizza query → state)
- Nelle funzioni `applyUserAdjustment` e `applyCategoryAdjustment`: fare `upsert` sulla tabella (`ON CONFLICT (project_id, adjustment_type, target_id)`) e poi invalidare la query
- Nella rimozione singola (click sulla X del badge): fare `delete` dal DB e invalidare
- In `clearAdjustments`: fare `delete` di tutti i record del progetto e invalidare
- Le mutazioni aggiornano anche lo state locale per feedback immediato (optimistic update)

### Impatto
Le maggiorazioni persistono tra sessioni e refresh, incidendo sulle ore contabili, ore rimanenti da pianificare, e calcolo del progresso % del progetto.

### File modificati
- Nuova migration SQL
- `src/components/ProjectTimesheet.tsx`

