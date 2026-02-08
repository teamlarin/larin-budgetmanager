DELETE FROM activity_time_tracking
WHERE notes ILIKE '%Importato da CSV%'
AND created_at::date = '2026-02-08';