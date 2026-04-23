-- Add gmail_inbox_used column to track which inbox was used for Gmail signals
ALTER TABLE public.project_update_drafts
  ADD COLUMN IF NOT EXISTS gmail_inbox_used text;

-- Refresh PostgREST schema cache so the edge function sees the new column
NOTIFY pgrst, 'reload schema';