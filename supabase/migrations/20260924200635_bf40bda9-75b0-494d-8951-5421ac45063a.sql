ALTER TABLE public.project_update_drafts
  ADD COLUMN IF NOT EXISTS suggested_health public.project_update_health,
  ADD COLUMN IF NOT EXISTS suggested_roadblocks jsonb NOT NULL DEFAULT '[]'::jsonb;