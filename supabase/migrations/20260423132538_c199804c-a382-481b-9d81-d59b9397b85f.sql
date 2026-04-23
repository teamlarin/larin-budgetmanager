-- RPC: stato draft progress per la settimana corrente (admin only)
CREATE OR REPLACE FUNCTION public.admin_get_progress_drafts_status(p_week_start date DEFAULT NULL)
RETURNS TABLE(
  project_id uuid,
  project_name text,
  client_name text,
  project_leader_id uuid,
  project_leader_name text,
  has_slack boolean,
  has_drive_project boolean,
  has_drive_client boolean,
  has_client boolean,
  status text,
  reason text,
  draft_id uuid,
  draft_created_at timestamptz,
  slack_messages_count integer,
  drive_docs_count integer,
  gmail_messages_count integer,
  sources_used jsonb,
  published_update_id uuid,
  week_start date
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_week_start date;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Accesso negato: solo admin';
  END IF;

  v_week_start := COALESCE(
    p_week_start,
    (date_trunc('week', (now() AT TIME ZONE 'Europe/Rome'))::date)
  );

  RETURN QUERY
  WITH eligible AS (
    SELECT
      p.id,
      p.name,
      p.slack_channel_id,
      p.drive_folder_id AS project_drive_folder_id,
      p.client_id,
      p.project_leader_id,
      c.name AS client_name,
      c.drive_folder_id AS client_drive_folder_id,
      pr.full_name AS leader_name
    FROM public.projects p
    LEFT JOIN public.clients c ON c.id = p.client_id
    LEFT JOIN public.profiles pr ON pr.id = p.project_leader_id
    WHERE p.status = 'approvato'
      AND (p.project_status IS NULL OR p.project_status <> 'completato')
  ),
  draft_current AS (
    SELECT d.*
    FROM public.project_update_drafts d
    WHERE d.week_start = v_week_start
  ),
  update_current AS (
    SELECT pu.id, pu.project_id
    FROM public.project_progress_updates pu
    WHERE pu.created_at >= (v_week_start::timestamp AT TIME ZONE 'Europe/Rome')
  )
  SELECT
    e.id AS project_id,
    e.name AS project_name,
    e.client_name,
    e.project_leader_id,
    e.leader_name AS project_leader_name,
    (e.slack_channel_id IS NOT NULL) AS has_slack,
    (e.project_drive_folder_id IS NOT NULL) AS has_drive_project,
    (e.client_drive_folder_id IS NOT NULL) AS has_drive_client,
    (e.client_id IS NOT NULL) AS has_client,
    CASE
      WHEN uc.id IS NOT NULL THEN 'published'
      WHEN dc.id IS NOT NULL AND dc.status = 'pending' THEN 'generated'
      WHEN dc.id IS NOT NULL AND dc.status = 'approved' THEN 'approved'
      WHEN dc.id IS NOT NULL AND dc.status = 'discarded' THEN 'discarded'
      WHEN e.slack_channel_id IS NULL
           AND e.project_drive_folder_id IS NULL
           AND e.client_drive_folder_id IS NULL
           AND e.client_id IS NULL
        THEN 'skipped_no_sources'
      ELSE 'pending'
    END AS status,
    CASE
      WHEN uc.id IS NOT NULL
        THEN 'Già pubblicato un progress update questa settimana'
      WHEN dc.id IS NOT NULL AND dc.status = 'pending'
        THEN 'Bozza generata, in attesa di revisione del Project Leader'
      WHEN dc.id IS NOT NULL AND dc.status = 'approved'
        THEN 'Bozza approvata e pubblicata'
      WHEN dc.id IS NOT NULL AND dc.status = 'discarded'
        THEN 'Bozza scartata dal Project Leader'
      WHEN e.slack_channel_id IS NULL
           AND e.project_drive_folder_id IS NULL
           AND e.client_drive_folder_id IS NULL
           AND e.client_id IS NULL
        THEN 'Nessuna fonte collegata: manca canale Slack, cartella Drive (progetto/cliente) e cliente per Gmail'
      ELSE
        'In attesa: il prossimo cron giovedì alle 12:00 IT proverà a generare la bozza' ||
        CASE
          WHEN e.slack_channel_id IS NULL THEN ' · senza Slack'
          ELSE ''
        END ||
        CASE
          WHEN e.project_drive_folder_id IS NULL AND e.client_drive_folder_id IS NULL THEN ' · senza Drive'
          ELSE ''
        END ||
        CASE
          WHEN e.client_id IS NULL THEN ' · senza Gmail'
          ELSE ''
        END
    END AS reason,
    dc.id AS draft_id,
    dc.created_at AS draft_created_at,
    COALESCE(dc.slack_messages_count, 0) AS slack_messages_count,
    COALESCE(dc.drive_docs_count, 0) AS drive_docs_count,
    COALESCE(dc.gmail_messages_count, 0) AS gmail_messages_count,
    dc.sources_used,
    uc.id AS published_update_id,
    v_week_start AS week_start
  FROM eligible e
  LEFT JOIN draft_current dc ON dc.project_id = e.id
  LEFT JOIN update_current uc ON uc.project_id = e.id
  ORDER BY
    CASE
      WHEN uc.id IS NOT NULL THEN 4
      WHEN dc.id IS NOT NULL THEN 2
      WHEN e.slack_channel_id IS NULL
           AND e.project_drive_folder_id IS NULL
           AND e.client_drive_folder_id IS NULL
           AND e.client_id IS NULL THEN 3
      ELSE 1
    END,
    e.name;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_progress_drafts_status(date) TO authenticated;