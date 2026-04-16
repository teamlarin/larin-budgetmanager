
-- Disabilita trigger di audit sui progetti
ALTER TABLE projects DISABLE TRIGGER trigger_log_project_changes;
ALTER TABLE projects DISABLE TRIGGER trigger_log_project_creation;

-- Aggiorna account_user_id nei progetti in base al cliente
UPDATE projects p
SET account_user_id = c.account_user_id
FROM clients c
WHERE p.client_id = c.id
  AND c.account_user_id IS NOT NULL
  AND p.account_user_id IS DISTINCT FROM c.account_user_id;

-- Riabilita i trigger
ALTER TABLE projects ENABLE TRIGGER trigger_log_project_changes;
ALTER TABLE projects ENABLE TRIGGER trigger_log_project_creation;

-- Verifica e correggi anche eventuali residui nei budget
ALTER TABLE budgets DISABLE TRIGGER trigger_log_budget_change;

UPDATE budgets b
SET account_user_id = c.account_user_id
FROM clients c
WHERE b.client_id = c.id
  AND c.account_user_id IS NOT NULL
  AND b.account_user_id IS DISTINCT FROM c.account_user_id;

ALTER TABLE budgets ENABLE TRIGGER trigger_log_budget_change;
