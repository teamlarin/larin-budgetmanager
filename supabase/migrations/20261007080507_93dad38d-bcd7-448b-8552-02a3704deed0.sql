CREATE TABLE public.project_completed_webhook_queue (
  project_id uuid PRIMARY KEY REFERENCES public.projects(id) ON DELETE CASCADE,
  completed_at timestamptz NOT NULL DEFAULT now(),
  send_after timestamptz NOT NULL DEFAULT now() + interval '48 hours',
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  sent_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.project_completed_webhook_queue TO authenticated;
GRANT ALL ON public.project_completed_webhook_queue TO service_role;
ALTER TABLE public.project_completed_webhook_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view completed webhook queue"
ON public.project_completed_webhook_queue FOR SELECT TO authenticated
USING (public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.enqueue_project_completed_webhook()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.project_status = 'completato' AND OLD.project_status IS DISTINCT FROM 'completato' THEN
    INSERT INTO public.project_completed_webhook_queue (project_id, completed_at, send_after, status, attempts, sent_at, last_error)
    VALUES (NEW.id, now(), now() + interval '48 hours', 'pending', 0, NULL, NULL)
    ON CONFLICT (project_id) DO UPDATE
      SET completed_at = EXCLUDED.completed_at, send_after = EXCLUDED.send_after,
          status = 'pending', attempts = 0, last_error = NULL, updated_at = now()
      WHERE public.project_completed_webhook_queue.status <> 'sent';
  ELSIF OLD.project_status = 'completato' AND NEW.project_status IS DISTINCT FROM 'completato' THEN
    DELETE FROM public.project_completed_webhook_queue WHERE project_id = NEW.id AND status <> 'sent';
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'enqueue_project_completed_webhook: %', SQLERRM;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.enqueue_project_completed_webhook() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trigger_project_completed_webhook ON public.projects;
DROP TRIGGER IF EXISTS trigger_enqueue_project_completed_webhook ON public.projects;
CREATE TRIGGER trigger_enqueue_project_completed_webhook
AFTER UPDATE OF project_status ON public.projects
FOR EACH ROW EXECUTE FUNCTION public.enqueue_project_completed_webhook();