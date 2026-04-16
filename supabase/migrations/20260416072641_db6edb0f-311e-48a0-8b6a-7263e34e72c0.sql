-- Disabilita solo il trigger di audit
ALTER TABLE budgets DISABLE TRIGGER trigger_log_budget_change;

-- Aggiorna account_user_id nei budget in base al cliente
UPDATE budgets b
SET account_user_id = c.account_user_id
FROM clients c
WHERE b.client_id = c.id
  AND c.account_user_id IS NOT NULL
  AND b.account_user_id IS DISTINCT FROM c.account_user_id;

-- Riabilita il trigger
ALTER TABLE budgets ENABLE TRIGGER trigger_log_budget_change;