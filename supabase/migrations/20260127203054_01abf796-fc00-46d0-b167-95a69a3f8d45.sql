-- Indice per query su scheduled_date globali (range queries nel Workload)
CREATE INDEX IF NOT EXISTS idx_activity_time_tracking_date ON activity_time_tracking(scheduled_date);

-- Indice per lookup veloci dei membri progetto per user_id
CREATE INDEX IF NOT EXISTS idx_project_members_user_id ON project_members(user_id);

-- Indice composito per query frequenti su budget_items
CREATE INDEX IF NOT EXISTS idx_budget_items_project_assignee ON budget_items(project_id, assignee_id);

-- Indice per ottimizzare le query sulla dashboard Team Leader
CREATE INDEX IF NOT EXISTS idx_activity_time_tracking_budget_item ON activity_time_tracking(budget_item_id);