-- Modify levels table to allow multiple areas per level
ALTER TABLE public.levels 
  DROP COLUMN area;

ALTER TABLE public.levels 
  ADD COLUMN areas level_area[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.levels.areas IS 'Multiple areas assigned to this level';