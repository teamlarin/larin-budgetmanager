ALTER TABLE public.project_update_drafts
  ADD COLUMN IF NOT EXISTS drive_docs_count integer,
  ADD COLUMN IF NOT EXISTS gmail_messages_count integer,
  ADD COLUMN IF NOT EXISTS sources_used jsonb NOT NULL DEFAULT '[]'::jsonb;