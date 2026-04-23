DROP FUNCTION IF EXISTS public.admin_get_progress_drafts_status(date);

CREATE OR REPLACE FUNCTION public.admin_get_progress_drafts_status(p_week_start date)
RETURNS TABLE (
  project_id uuid,
  project_name text,
  client_name text,
  project_leader_id uuid,
  project_leader_name text,
  status text,
  reason text,
  slack_count integer,
  drive_count integer,
  gmail_count integer,
  gmail_inbox_used text,
  draft_id uuid,
  draft_created_at timestamptz,
  has_slack boolean,
  has_drive boolean,
  has_gmail_sources boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  RETURN QUERY
  WITH eligible AS (
    SELECT
      p.id,
      p.name,
      p.project_leader_id,
      p.slack_channel_id,
      p.drive_folder_id AS project_drive_folder_id,
      p.client_id,
      c.name AS client_name,
      c.drive_folder_id AS client_drive_folder_id
    FROM public.projects p
    LEFT JOIN public.clients c ON c.id = p.client_id
    WHERE p.status = 'approvato'
      AND (p.project_status IS NULL OR p.project_status <> 'completato')
  ),
  drafts AS (
    SELECT DISTINCT ON (d.project_id)
      d.project_id,
      d.id AS draft_id,
      d.status AS draft_status,
      d.created_at,
      d.slack_messages_count,
      d.drive_docs_count,
      d.gmail_messages_count,
      d.gmail_inbox_used,
      d.published_progress_update_id
    FROM public.project_update_drafts d
    WHERE d.week_start = p_week_start
    ORDER BY d.project_id, d.created_at DESC
  ),
  updates AS (
    SELECT DISTINCT ON (u.project_id)
      u.project_id,
      u.id AS update_id
    FROM public.project_progress_updates u
    WHERE u.created_at >= p_week_start::timestamptz
      AND u.created_at < (p_week_start + INTERVAL '7 days')::timestamptz
    ORDER BY u.project_id, u.created_at DESC
  )
  SELECT
    e.id AS project_id,
    e.name AS project_name,
    e.client_name,
    e.project_leader_id,
    pr.full_name AS project_leader_name,
    CASE
      WHEN u.update_id IS NOT NULL THEN 'published'
      WHEN d.draft_status = 'pending' THEN 'generated'
      WHEN d.draft_status = 'approved' THEN 'approved'
      WHEN d.draft_status = 'discarded' THEN 'discarded'
      WHEN e.slack_channel_id IS NULL
        AND e.project_drive_folder_id IS NULL
        AND e.client_drive_folder_id IS NULL
        AND e.client_id IS NULL
        THEN 'skipped_no_sources'
      ELSE 'pending'
    END AS status,
    CASE
      WHEN u.update_id IS NOT NULL THEN 'Update settimanale già pubblicato'
      WHEN d.draft_status = 'pending' THEN 'Bozza generata, in attesa di revisione'
      WHEN d.draft_status = 'approved' THEN 'Bozza approvata'
      WHEN d.draft_status = 'discarded' THEN 'Bozza scartata dal PM'
      WHEN e.slack_channel_id IS NULL
        AND e.project_drive_folder_id IS NULL
        AND e.client_drive_folder_id IS NULL
        AND e.client_id IS NULL
        THEN 'Nessuna fonte collegata (Slack, Drive, cliente)'
      ELSE 'In attesa del cron del giovedì'
    END AS reason,
    COALESCE(d.slack_messages_count, 0) AS slack_count,
    COALESCE(d.drive_docs_count, 0) AS drive_count,
    COALESCE(d.gmail_messages_count, 0) AS gmail_count,
    d.gmail_inbox_used,
    d.draft_id,
    d.created_at AS draft_created_at,
    (e.slack_channel_id IS NOT NULL) AS has_slack,
    (e.project_drive_folder_id IS NOT NULL OR e.client_drive_folder_id IS NOT NULL) AS has_drive,
    (e.client_id IS NOT NULL) AS has_gmail_sources
  FROM eligible e
  LEFT JOIN public.profiles pr ON pr.id = e.project_leader_id
  LEFT JOIN drafts d ON d.project_id = e.id
  LEFT JOIN updates u ON u.project_id = e.id
  ORDER BY e.name;
END;
$$;