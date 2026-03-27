
CREATE TABLE public.project_timesheet_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  adjustment_type text NOT NULL CHECK (adjustment_type IN ('user', 'category')),
  target_id text NOT NULL,
  percentage numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (project_id, adjustment_type, target_id)
);

ALTER TABLE project_timesheet_adjustments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage adjustments"
  ON project_timesheet_adjustments FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
