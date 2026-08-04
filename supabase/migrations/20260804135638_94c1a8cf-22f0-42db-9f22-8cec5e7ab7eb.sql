ALTER TABLE public.user_calendar_settings
ADD COLUMN IF NOT EXISTS default_view text NOT NULL DEFAULT 'week';

ALTER TABLE public.user_calendar_settings
ADD CONSTRAINT user_calendar_settings_default_view_check CHECK (default_view IN ('week', 'planning'));