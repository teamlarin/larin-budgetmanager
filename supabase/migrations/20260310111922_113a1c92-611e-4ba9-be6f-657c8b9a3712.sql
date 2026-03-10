
-- Workflow Templates
CREATE TABLE public.workflow_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Workflow Task Templates
CREATE TABLE public.workflow_task_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES public.workflow_templates(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  display_order INT NOT NULL DEFAULT 0,
  depends_on_task_id UUID REFERENCES public.workflow_task_templates(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Active Workflow Flows
CREATE TABLE public.workflow_flows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES public.workflow_templates(id) ON DELETE SET NULL,
  template_name TEXT NOT NULL,
  custom_name TEXT NOT NULL,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- Active Workflow Flow Tasks
CREATE TABLE public.workflow_flow_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id UUID NOT NULL REFERENCES public.workflow_flows(id) ON DELETE CASCADE,
  task_template_id UUID REFERENCES public.workflow_task_templates(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  display_order INT NOT NULL DEFAULT 0,
  depends_on_task_id UUID,
  assignee_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.workflow_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_task_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_flows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_flow_tasks ENABLE ROW LEVEL SECURITY;

-- RLS: All authenticated approved users can read templates
CREATE POLICY "Authenticated users can read templates"
  ON public.workflow_templates FOR SELECT TO authenticated
  USING (public.is_approved_user(auth.uid()));

-- RLS: Admins can manage templates
CREATE POLICY "Admins can insert templates"
  ON public.workflow_templates FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update templates"
  ON public.workflow_templates FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete templates"
  ON public.workflow_templates FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS: Task templates follow parent template access
CREATE POLICY "Authenticated users can read task templates"
  ON public.workflow_task_templates FOR SELECT TO authenticated
  USING (public.is_approved_user(auth.uid()));

CREATE POLICY "Admins can insert task templates"
  ON public.workflow_task_templates FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update task templates"
  ON public.workflow_task_templates FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete task templates"
  ON public.workflow_task_templates FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS: Flows - all approved users can read all flows, create flows
CREATE POLICY "Approved users can read flows"
  ON public.workflow_flows FOR SELECT TO authenticated
  USING (public.is_approved_user(auth.uid()));

CREATE POLICY "Approved users can create flows"
  ON public.workflow_flows FOR INSERT TO authenticated
  WITH CHECK (public.is_approved_user(auth.uid()));

CREATE POLICY "Approved users can update flows"
  ON public.workflow_flows FOR UPDATE TO authenticated
  USING (public.is_approved_user(auth.uid()));

CREATE POLICY "Admins can delete flows"
  ON public.workflow_flows FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS: Flow tasks
CREATE POLICY "Approved users can read flow tasks"
  ON public.workflow_flow_tasks FOR SELECT TO authenticated
  USING (public.is_approved_user(auth.uid()));

CREATE POLICY "Approved users can insert flow tasks"
  ON public.workflow_flow_tasks FOR INSERT TO authenticated
  WITH CHECK (public.is_approved_user(auth.uid()));

CREATE POLICY "Approved users can update flow tasks"
  ON public.workflow_flow_tasks FOR UPDATE TO authenticated
  USING (public.is_approved_user(auth.uid()));

CREATE POLICY "Admins can delete flow tasks"
  ON public.workflow_flow_tasks FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Trigger for updated_at on templates
CREATE TRIGGER update_workflow_templates_updated_at
  BEFORE UPDATE ON public.workflow_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
