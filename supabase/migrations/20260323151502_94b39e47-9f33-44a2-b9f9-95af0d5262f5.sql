-- Clean up duplicate assignment records (keep only the oldest one per budget_item_id + user_id where scheduled_date IS NULL)
DELETE FROM activity_time_tracking
WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (
      PARTITION BY budget_item_id, user_id
      ORDER BY created_at ASC
    ) as rn
    FROM activity_time_tracking
    WHERE scheduled_date IS NULL
      AND actual_start_time IS NULL
      AND actual_end_time IS NULL
      AND scheduled_start_time IS NULL
      AND scheduled_end_time IS NULL
  ) sub
  WHERE rn > 1
);

-- Add a unique partial index to prevent future duplicates for pure assignments
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_assignment_per_user_activity
ON activity_time_tracking (budget_item_id, user_id)
WHERE scheduled_date IS NULL
  AND actual_start_time IS NULL
  AND actual_end_time IS NULL
  AND scheduled_start_time IS NULL
  AND scheduled_end_time IS NULL;