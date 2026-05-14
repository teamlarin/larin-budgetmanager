
CREATE TABLE public.meet_attachment_copies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tracking_id uuid REFERENCES public.activity_time_tracking(id) ON DELETE CASCADE,
  google_event_id text NOT NULL,
  source_file_id text NOT NULL,
  copied_file_id text,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  copied_by uuid,
  copied_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tracking_id, source_file_id)
);

CREATE INDEX idx_meet_attachment_copies_event ON public.meet_attachment_copies(google_event_id);
CREATE INDEX idx_meet_attachment_copies_project ON public.meet_attachment_copies(project_id);

ALTER TABLE public.meet_attachment_copies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own meet attachment copies"
  ON public.meet_attachment_copies FOR SELECT
  TO authenticated
  USING (copied_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));
