-- Add Google Drive folder columns to clients table
ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS drive_folder_id TEXT,
ADD COLUMN IF NOT EXISTS drive_folder_name TEXT;