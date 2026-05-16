
-- Cleanup leftover setting
DELETE FROM public.app_settings WHERE setting_key = 'jethr_sync_status';

-- Mapping table: keyword → budget_item del progetto OFF
CREATE TABLE public.jethr_absence_mappings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  keyword TEXT NOT NULL,
  budget_item_id UUID NOT NULL REFERENCES public.budget_items(id) ON DELETE CASCADE,
  priority INTEGER NOT NULL DEFAULT 100,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_jethr_mappings_priority ON public.jethr_absence_mappings(priority);
CREATE UNIQUE INDEX idx_jethr_mappings_one_default ON public.jethr_absence_mappings(is_default) WHERE is_default = true;

ALTER TABLE public.jethr_absence_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read jethr mappings"
  ON public.jethr_absence_mappings FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admins manage jethr mappings"
  ON public.jethr_absence_mappings FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER set_jethr_mappings_updated_at
  BEFORE UPDATE ON public.jethr_absence_mappings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Log table for auto-link idempotency + audit
CREATE TABLE public.jethr_auto_link_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  google_event_id TEXT NOT NULL,
  budget_item_id UUID,
  tracking_id UUID,
  status TEXT NOT NULL,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_jethr_log_event ON public.jethr_auto_link_log(google_event_id);
CREATE INDEX idx_jethr_log_created ON public.jethr_auto_link_log(created_at DESC);

ALTER TABLE public.jethr_auto_link_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read jethr log"
  ON public.jethr_auto_link_log FOR SELECT
  TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Default settings rows
INSERT INTO public.app_settings (setting_key, setting_value, description) VALUES
  ('jethr_enabled', 'false'::jsonb, 'Abilita l''auto-link degli eventi JetHr da Google Calendar'),
  ('jethr_detection', '{"organizer_email_patterns":["@jethr.com","@jethr.io","jethr"],"keywords":["jethr","ferie","permesso","malattia","rol","banca ore"]}'::jsonb, 'Pattern per riconoscere eventi JetHr'),
  ('jethr_slack_channel', '""'::jsonb, 'Canale Slack per notifiche assenze JetHr'),
  ('jethr_default_times', '{"start":"09:00","end":"18:00"}'::jsonb, 'Orari di default per eventi JetHr all-day')
ON CONFLICT (setting_key) DO NOTHING;
