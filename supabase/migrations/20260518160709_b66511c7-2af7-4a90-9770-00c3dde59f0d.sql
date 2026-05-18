DELETE FROM activity_time_tracking
WHERE google_event_id IN (SELECT google_event_id FROM jethr_auto_link_log);
TRUNCATE TABLE jethr_auto_link_log;