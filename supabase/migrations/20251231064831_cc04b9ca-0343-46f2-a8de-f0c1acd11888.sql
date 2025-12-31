-- Update existing imported entries to populate scheduled_start_time and scheduled_end_time
-- by extracting the time from actual_start_time and actual_end_time
UPDATE activity_time_tracking
SET 
  scheduled_start_time = (actual_start_time AT TIME ZONE 'UTC')::time,
  scheduled_end_time = (actual_end_time AT TIME ZONE 'UTC')::time
WHERE scheduled_start_time IS NULL 
  AND scheduled_end_time IS NULL
  AND actual_start_time IS NOT NULL 
  AND actual_end_time IS NOT NULL;