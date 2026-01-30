-- Fix existing activity_time_tracking records where actual times are stored incorrectly
-- The issue: times were saved as UTC when they should have been interpreted as local time (Europe/Rome)
-- Solution: Recalculate actual times from scheduled date+time with proper timezone

UPDATE activity_time_tracking
SET 
  actual_start_time = (scheduled_date + scheduled_start_time) AT TIME ZONE 'Europe/Rome',
  actual_end_time = (scheduled_date + scheduled_end_time) AT TIME ZONE 'Europe/Rome'
WHERE 
  actual_start_time IS NOT NULL
  AND actual_end_time IS NOT NULL
  AND scheduled_date IS NOT NULL
  AND scheduled_start_time IS NOT NULL
  AND scheduled_end_time IS NOT NULL;