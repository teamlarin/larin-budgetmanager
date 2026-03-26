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

-- Fix recurring projects.progress field too
UPDATE projects
SET progress = LEAST(100, GREATEST(0, ROUND(
  EXTRACT(EPOCH FROM (NOW() - start_date)) / 
  NULLIF(EXTRACT(EPOCH FROM (end_date - start_date)), 0) * 100
)))::int
WHERE billing_type = 'recurring'
  AND start_date IS NOT NULL
  AND end_date IS NOT NULL;