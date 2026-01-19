-- Delete all clients imported from HubSpot on January 19, 2026 (after 20:08)
DELETE FROM clients WHERE created_at >= '2026-01-19 20:08:00+00';