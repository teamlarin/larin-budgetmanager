
-- Normalize existing values to lowercase
UPDATE public.projects
SET area = lower(area)
WHERE area IS NOT NULL AND area <> lower(area);

UPDATE public.profiles
SET area = lower(area)
WHERE area IS NOT NULL AND area <> lower(area);

-- Drop existing constraints if present (idempotent)
ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS projects_area_valid;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_area_valid;

-- Add CHECK constraints
ALTER TABLE public.projects
  ADD CONSTRAINT projects_area_valid
  CHECK (area IS NULL OR area IN ('marketing','tech','branding','sales','ai','struttura','interno'));

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_area_valid
  CHECK (area IS NULL OR area IN ('marketing','tech','branding','sales','ai','struttura','interno'));
