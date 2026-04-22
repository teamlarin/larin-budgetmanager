ALTER TABLE public.help_feedback
ADD COLUMN IF NOT EXISTS entity_id TEXT,
ADD COLUMN IF NOT EXISTS entity_type TEXT;

CREATE INDEX IF NOT EXISTS idx_help_feedback_entity
ON public.help_feedback (entity_type, entity_id);