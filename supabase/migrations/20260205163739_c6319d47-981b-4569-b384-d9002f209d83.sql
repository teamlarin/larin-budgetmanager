-- Add hubspot_id field to clients table for storing the HubSpot record ID
ALTER TABLE public.clients 
ADD COLUMN hubspot_id text;