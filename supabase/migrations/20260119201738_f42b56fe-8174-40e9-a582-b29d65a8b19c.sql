-- Delete all 799 clients imported from HubSpot on January 19, 2026
DELETE FROM clients WHERE created_at >= '2026-01-19 20:07:00+00';