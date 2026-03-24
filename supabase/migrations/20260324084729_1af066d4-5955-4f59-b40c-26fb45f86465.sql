
CREATE TABLE public.user_hours_adjustments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  month date NOT NULL,
  adjustment_hours numeric NOT NULL DEFAULT 0,
  reason text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, month)
);

ALTER TABLE public.user_hours_adjustments ENABLE ROW LEVEL SECURITY;

-- Approved users can read
CREATE POLICY "Approved users can view hour adjustments"
  ON public.user_hours_adjustments FOR SELECT
  TO authenticated
  USING (is_approved_user(auth.uid()));

-- Admin and coordinator can manage
CREATE POLICY "Admins can manage hour adjustments"
  ON public.user_hours_adjustments FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Coordinators can manage hour adjustments"
  ON public.user_hours_adjustments FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'coordinator'::app_role))
  WITH CHECK (has_role(auth.uid(), 'coordinator'::app_role));
