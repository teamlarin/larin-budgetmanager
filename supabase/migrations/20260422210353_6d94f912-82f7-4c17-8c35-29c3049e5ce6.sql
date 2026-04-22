-- Add Slack channel binding to projects
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS slack_channel_id TEXT,
  ADD COLUMN IF NOT EXISTS slack_channel_name TEXT;

-- Drafts table for AI-generated progress updates
CREATE TABLE IF NOT EXISTS public.project_update_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  draft_content TEXT NOT NULL,
  generated_from TEXT NOT NULL DEFAULT 'slack_ai',
  slack_messages_count INTEGER,
  week_start DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'published', 'discarded')),
  published_progress_update_id UUID NULL REFERENCES public.project_progress_updates(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_update_drafts_project_status
  ON public.project_update_drafts (project_id, status);

-- Prevent multiple pending drafts for the same week+project
CREATE UNIQUE INDEX IF NOT EXISTS uq_project_update_drafts_pending_week
  ON public.project_update_drafts (project_id, week_start)
  WHERE status = 'pending';

ALTER TABLE public.project_update_drafts ENABLE ROW LEVEL SECURITY;

-- SELECT: admins, project leader, account, project creator
CREATE POLICY "View drafts: admin/leader/account/creator"
ON public.project_update_drafts
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_update_drafts.project_id
      AND (
        p.project_leader_id = auth.uid()
        OR p.account_user_id = auth.uid()
        OR p.user_id = auth.uid()
      )
  )
);

-- UPDATE: same set (review/publish/discard)
CREATE POLICY "Update drafts: admin/leader/account/creator"
ON public.project_update_drafts
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_update_drafts.project_id
      AND (
        p.project_leader_id = auth.uid()
        OR p.account_user_id = auth.uid()
        OR p.user_id = auth.uid()
      )
  )
);

-- DELETE: only admins
CREATE POLICY "Delete drafts: admin only"
ON public.project_update_drafts
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- INSERT: only admins through the app (cron uses service role and bypasses RLS)
CREATE POLICY "Insert drafts: admin only"
ON public.project_update_drafts
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));