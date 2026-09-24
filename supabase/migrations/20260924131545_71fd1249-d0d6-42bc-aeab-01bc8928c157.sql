DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'project_update_health') THEN
    CREATE TYPE public.project_update_health AS ENUM ('in_linea', 'attenzione', 'bloccato');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'roadblock_type') THEN
    CREATE TYPE public.roadblock_type AS ENUM ('persone', 'risorse', 'strumenti', 'informazioni', 'attenzione_cliente', 'decisioni', 'dipendenze_esterne');
  END IF;
END $$;

ALTER TABLE public.project_progress_updates
  ADD COLUMN IF NOT EXISTS health_status public.project_update_health NOT NULL DEFAULT 'in_linea';

CREATE TABLE IF NOT EXISTS public.project_roadblocks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  progress_update_id uuid REFERENCES public.project_progress_updates(id) ON DELETE SET NULL,
  description text NOT NULL,
  blocker_type public.roadblock_type NOT NULL DEFAULT 'informazioni',
  waiting_on_who text,
  waiting_on_what text,
  opened_at timestamp with time zone NOT NULL DEFAULT now(),
  resolved_at timestamp with time zone,
  resolution_note text,
  created_by uuid,
  resolved_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_roadblocks_project ON public.project_roadblocks(project_id);
CREATE INDEX IF NOT EXISTS idx_project_roadblocks_open ON public.project_roadblocks(project_id) WHERE resolved_at IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_roadblocks TO authenticated;
GRANT ALL ON public.project_roadblocks TO service_role;

ALTER TABLE public.project_roadblocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "roadblocks_select" ON public.project_roadblocks;
CREATE POLICY "roadblocks_select" ON public.project_roadblocks
  FOR SELECT TO authenticated
  USING (public.can_access_project_tasks(project_id));

DROP POLICY IF EXISTS "roadblocks_insert" ON public.project_roadblocks;
CREATE POLICY "roadblocks_insert" ON public.project_roadblocks
  FOR INSERT TO authenticated
  WITH CHECK (public.can_update_project_progress(project_id));

DROP POLICY IF EXISTS "roadblocks_update" ON public.project_roadblocks;
CREATE POLICY "roadblocks_update" ON public.project_roadblocks
  FOR UPDATE TO authenticated
  USING (public.can_update_project_progress(project_id))
  WITH CHECK (public.can_update_project_progress(project_id));

DROP POLICY IF EXISTS "roadblocks_delete" ON public.project_roadblocks;
CREATE POLICY "roadblocks_delete" ON public.project_roadblocks
  FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.set_project_roadblocks_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_project_roadblocks_updated_at ON public.project_roadblocks;
CREATE TRIGGER trg_project_roadblocks_updated_at
  BEFORE UPDATE ON public.project_roadblocks
  FOR EACH ROW EXECUTE FUNCTION public.set_project_roadblocks_updated_at();

INSERT INTO public.project_roadblocks (project_id, progress_update_id, description, blocker_type, opened_at, created_by, created_at)
SELECT pu.project_id, pu.id, pu.roadblocks_text, 'informazioni', pu.created_at, pu.user_id, pu.created_at
FROM public.project_progress_updates pu
WHERE pu.roadblocks_text IS NOT NULL
  AND btrim(pu.roadblocks_text) <> ''
  AND NOT EXISTS (
    SELECT 1 FROM public.project_roadblocks r WHERE r.progress_update_id = pu.id
  );