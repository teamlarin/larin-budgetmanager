ALTER TABLE public.activity_time_tracking
ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_activity_time_tracking_client_id
ON public.activity_time_tracking(client_id);