-- Aggiorna permessi per i ruoli secondo le nuove regole:
-- Budget: approvato solo da team_leader e admin, creato anche da coordinator
-- Preventivi: modificati e approvati da admin, account e team_leader

-- Account: può modificare preventivi ma NON approvare budget
UPDATE role_permissions SET 
  can_edit_budget = false,
  can_edit_quotes = true
WHERE role = 'account';

-- Team Leader: può approvare budget E modificare preventivi
UPDATE role_permissions SET 
  can_edit_budget = true,
  can_edit_quotes = true
WHERE role = 'team_leader';

-- Coordinator: può creare/modificare budget ma NON approvarlo, NON può modificare preventivi
UPDATE role_permissions SET 
  can_edit_budget = true,
  can_edit_quotes = false
WHERE role = 'coordinator';

-- Finance: NON può approvare budget né modificare preventivi
UPDATE role_permissions SET 
  can_edit_budget = false,
  can_edit_quotes = false
WHERE role = 'finance';

-- Member: nessun permesso speciale
UPDATE role_permissions SET 
  can_edit_budget = false,
  can_edit_quotes = false
WHERE role = 'member';