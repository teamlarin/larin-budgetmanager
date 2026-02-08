DELETE FROM activity_time_tracking
WHERE notes ILIKE '%Importato da CSV%'
AND created_at >= '2026-02-08 20:56:00';