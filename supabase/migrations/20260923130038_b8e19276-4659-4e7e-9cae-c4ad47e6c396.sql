-- helper
CREATE OR REPLACE FUNCTION public.can_manage_project_retrospective(_project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.is_approved_user(auth.uid()) AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'team_leader')
    OR EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = _project_id
        AND (p.project_leader_id = auth.uid() OR p.account_user_id = auth.uid())
    )
  )
$$;

-- 1. retrospectives
CREATE TABLE public.project_retrospectives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL UNIQUE REFERENCES public.projects(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'bozza',
  meeting_at timestamptz,
  meeting_link text,
  facilitator_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  summary text,
  key_points text,
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  survey_sent_at timestamptz,
  completed_at timestamptz,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT project_retrospectives_status_check CHECK (status IN ('bozza','questionario_inviato','incontro_fissato','completata'))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_retrospectives TO authenticated;
GRANT ALL ON public.project_retrospectives TO service_role;
ALTER TABLE public.project_retrospectives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project members can view retrospectives"
  ON public.project_retrospectives FOR SELECT TO authenticated
  USING (public.can_access_project_tasks(project_id));
CREATE POLICY "Managers can insert retrospectives"
  ON public.project_retrospectives FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_project_retrospective(project_id));
CREATE POLICY "Managers can update retrospectives"
  ON public.project_retrospectives FOR UPDATE TO authenticated
  USING (public.can_manage_project_retrospective(project_id))
  WITH CHECK (public.can_manage_project_retrospective(project_id));
CREATE POLICY "Managers can delete retrospectives"
  ON public.project_retrospectives FOR DELETE TO authenticated
  USING (public.can_manage_project_retrospective(project_id));

CREATE TRIGGER update_project_retrospectives_updated_at
  BEFORE UPDATE ON public.project_retrospectives
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. surveys
CREATE TABLE public.project_retrospective_surveys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  retrospective_id uuid NOT NULL REFERENCES public.project_retrospectives(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  answer_structure text,
  answer_communication text,
  answer_client text,
  answer_golden_lesson text,
  submitted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (retrospective_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_retrospective_surveys TO authenticated;
GRANT ALL ON public.project_retrospective_surveys TO service_role;
ALTER TABLE public.project_retrospective_surveys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Own or managers can view survey answers"
  ON public.project_retrospective_surveys FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.project_retrospectives r
      WHERE r.id = retrospective_id
        AND public.can_manage_project_retrospective(r.project_id)
    )
  );
CREATE POLICY "Users can insert own survey answers"
  ON public.project_retrospective_surveys FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.project_retrospectives r
      WHERE r.id = retrospective_id
        AND public.can_access_project_tasks(r.project_id)
    )
  );
CREATE POLICY "Users can update own survey answers"
  ON public.project_retrospective_surveys FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users or managers can delete survey answers"
  ON public.project_retrospective_surveys FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.project_retrospectives r
      WHERE r.id = retrospective_id
        AND public.can_manage_project_retrospective(r.project_id)
    )
  );

CREATE TRIGGER update_project_retrospective_surveys_updated_at
  BEFORE UPDATE ON public.project_retrospective_surveys
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. deliverables
CREATE TABLE public.project_deliverables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  planned_date date,
  actual_date date,
  notes text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_deliverables TO authenticated;
GRANT ALL ON public.project_deliverables TO service_role;
ALTER TABLE public.project_deliverables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project members can view deliverables"
  ON public.project_deliverables FOR SELECT TO authenticated
  USING (public.can_access_project_tasks(project_id));
CREATE POLICY "Managers can insert deliverables"
  ON public.project_deliverables FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_project_retrospective(project_id));
CREATE POLICY "Managers can update deliverables"
  ON public.project_deliverables FOR UPDATE TO authenticated
  USING (public.can_manage_project_retrospective(project_id))
  WITH CHECK (public.can_manage_project_retrospective(project_id));
CREATE POLICY "Managers can delete deliverables"
  ON public.project_deliverables FOR DELETE TO authenticated
  USING (public.can_manage_project_retrospective(project_id));

CREATE INDEX idx_project_deliverables_project ON public.project_deliverables(project_id);

CREATE TRIGGER update_project_deliverables_updated_at
  BEFORE UPDATE ON public.project_deliverables
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. actions
CREATE TABLE public.project_retrospective_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  retrospective_id uuid NOT NULL REFERENCES public.project_retrospectives(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  owner_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  due_date date,
  status text NOT NULL DEFAULT 'da_pianificare',
  updates_playbook boolean NOT NULL DEFAULT false,
  target_project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  created_task_id uuid REFERENCES public.project_tasks(id) ON DELETE SET NULL,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT project_retrospective_actions_status_check CHECK (status IN ('da_pianificare','pianificata','in_corso','completata','annullata'))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_retrospective_actions TO authenticated;
GRANT ALL ON public.project_retrospective_actions TO service_role;
ALTER TABLE public.project_retrospective_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project members can view retro actions"
  ON public.project_retrospective_actions FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.project_retrospectives r
    WHERE r.id = retrospective_id AND public.can_access_project_tasks(r.project_id)
  ));
CREATE POLICY "Managers can insert retro actions"
  ON public.project_retrospective_actions FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.project_retrospectives r
    WHERE r.id = retrospective_id AND public.can_manage_project_retrospective(r.project_id)
  ));
CREATE POLICY "Managers can update retro actions"
  ON public.project_retrospective_actions FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.project_retrospectives r
    WHERE r.id = retrospective_id AND public.can_manage_project_retrospective(r.project_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.project_retrospectives r
    WHERE r.id = retrospective_id AND public.can_manage_project_retrospective(r.project_id)
  ));
CREATE POLICY "Managers can delete retro actions"
  ON public.project_retrospective_actions FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.project_retrospectives r
    WHERE r.id = retrospective_id AND public.can_manage_project_retrospective(r.project_id)
  ));

CREATE INDEX idx_retro_actions_retro ON public.project_retrospective_actions(retrospective_id);

CREATE TRIGGER update_project_retrospective_actions_updated_at
  BEFORE UPDATE ON public.project_retrospective_actions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. notify team when survey is sent
CREATE OR REPLACE FUNCTION public.notify_retrospective_survey_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _project_name text;
  _rec record;
BEGIN
  IF NEW.status = 'questionario_inviato'
     AND (OLD.status IS DISTINCT FROM NEW.status)
  THEN
    SELECT name INTO _project_name FROM public.projects WHERE id = NEW.project_id;

    FOR _rec IN
      SELECT DISTINCT user_id FROM (
        SELECT pm.user_id FROM public.project_members pm WHERE pm.project_id = NEW.project_id
        UNION
        SELECT p.project_leader_id AS user_id FROM public.projects p WHERE p.id = NEW.project_id AND p.project_leader_id IS NOT NULL
        UNION
        SELECT p.account_user_id AS user_id FROM public.projects p WHERE p.id = NEW.project_id AND p.account_user_id IS NOT NULL
      ) t
      WHERE user_id IS NOT NULL
    LOOP
      PERFORM public.notify_user_if_enabled(
        _rec.user_id,
        'retrospective_survey_request',
        'Questionario di retrospettiva',
        'Compila il questionario di retrospettiva per il progetto ' || COALESCE(_project_name, ''),
        NEW.project_id
      );
    END LOOP;

    IF NEW.survey_sent_at IS NULL THEN
      NEW.survey_sent_at := now();
    END IF;
  END IF;

  IF NEW.status = 'completata' AND NEW.completed_at IS NULL THEN
    NEW.completed_at := now();
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_retrospective_survey_request
  BEFORE UPDATE ON public.project_retrospectives
  FOR EACH ROW EXECUTE FUNCTION public.notify_retrospective_survey_request();