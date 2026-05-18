-- Cleanup righe JetHr corrotte (durata zero o orari UTC anziché Europe/Rome)
-- prima di rilanciare la sync con il fix timezone + all-day.

WITH bad_rows AS (
  SELECT id, google_event_id
  FROM activity_time_tracking
  WHERE google_event_id IN (SELECT google_event_id FROM jethr_auto_link_log)
    AND (
      scheduled_start_time = scheduled_end_time
      OR scheduled_start_time = '06:00:00'
      OR scheduled_start_time = '22:00:00'
    )
)
DELETE FROM activity_time_tracking
WHERE id IN (SELECT id FROM bad_rows);

-- Azzera tutto il log così la sync ricreerà le righe corrette
TRUNCATE TABLE jethr_auto_link_log;