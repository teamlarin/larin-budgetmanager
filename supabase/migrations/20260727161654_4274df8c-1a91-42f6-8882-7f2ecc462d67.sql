
CREATE TABLE public.project_quarter_webhook_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  quarter_number integer NOT NULL,
  trigger_date date NOT NULL,
  webhook_status integer,
  webhook_response text,
  sent_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (project_id, quarter_number)
);

GRANT SELECT ON public.project_quarter_webhook_log TO authenticated;
GRANT ALL ON public.project_quarter_webhook_log TO service_role;

ALTER TABLE public.project_quarter_webhook_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view quarter webhook log"
ON public.project_quarter_webhook_log
FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));
