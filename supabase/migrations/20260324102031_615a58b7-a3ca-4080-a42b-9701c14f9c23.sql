
CREATE TABLE public.user_hours_carryover (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  year integer NOT NULL,
  carryover_hours numeric NOT NULL DEFAULT 0,
  notes text,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, year)
);

ALTER TABLE public.user_hours_carryover ENABLE ROW LEVEL SECURITY;

-- Approved users can read
CREATE POLICY "Approved users can view carryover"
  ON public.user_hours_carryover FOR SELECT
  TO public
  USING (is_approved_user(auth.uid()));

-- Admin and finance can manage
CREATE POLICY "Admin and finance can manage carryover"
  ON public.user_hours_carryover FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role IN ('admin', 'finance')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role IN ('admin', 'finance')
    )
  );
