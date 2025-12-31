-- Delete duplicate imported timesheet entries, keeping only one per user/date/budget_item combination
DELETE FROM activity_time_tracking
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY user_id, scheduled_date, budget_item_id 
             ORDER BY created_at ASC
           ) as rn
    FROM activity_time_tracking
    WHERE budget_item_id IN (
      SELECT id FROM budget_items WHERE activity_name = 'Ore importate'
    )
  ) duplicates
  WHERE rn > 1
);