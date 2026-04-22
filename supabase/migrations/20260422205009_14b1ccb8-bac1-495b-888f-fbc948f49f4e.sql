-- Create project_decisions table
CREATE TABLE public.project_decisions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ,
  updated_by UUID
);

CREATE INDEX idx_project_decisions_project_id ON public.project_decisions(project_id);
CREATE INDEX idx_project_decisions_created_at ON public.project_decisions(created_at DESC);

-- Enable RLS
ALTER TABLE public.project_decisions ENABLE ROW LEVEL SECURITY;

-- SELECT: approved users can view all; external users only for assigned projects
CREATE POLICY "Approved users can view project decisions"
  ON public.project_decisions
  FOR SELECT
  TO authenticated
  USING (public.is_approved_user(auth.uid()));

CREATE POLICY "External users can view decisions of assigned projects"
  ON public.project_decisions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.external_project_access epa
      WHERE epa.project_id = project_decisions.project_id
        AND epa.user_id = auth.uid()
    )
  );

-- INSERT: admin, team_leader, coordinator, account
CREATE POLICY "Editor roles can insert project decisions"
  ON public.project_decisions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = created_by
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'team_leader'::app_role)
      OR public.has_role(auth.uid(), 'coordinator'::app_role)
      OR public.has_role(auth.uid(), 'account'::app_role)
    )
  );

-- UPDATE: author or admin
CREATE POLICY "Author or admin can update project decisions"
  ON public.project_decisions
  FOR UPDATE
  TO authenticated
  USING (
    created_by = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::app_role)
  )
  WITH CHECK (
    created_by = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

-- DELETE: author or admin
CREATE POLICY "Author or admin can delete project decisions"
  ON public.project_decisions
  FOR DELETE
  TO authenticated
  USING (
    created_by = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

-- Trigger to auto-populate updated_at on UPDATE
CREATE OR REPLACE FUNCTION public.set_project_decisions_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_project_decisions_updated_at
  BEFORE UPDATE ON public.project_decisions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_project_decisions_updated_at();