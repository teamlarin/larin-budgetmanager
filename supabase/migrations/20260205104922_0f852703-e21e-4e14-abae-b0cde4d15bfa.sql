-- Create table for user calendar settings
CREATE TABLE public.user_calendar_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  number_of_days INTEGER NOT NULL DEFAULT 7,
  show_weekends BOOLEAN NOT NULL DEFAULT true,
  timezone TEXT NOT NULL DEFAULT 'Europe/Rome',
  week_starts_on INTEGER NOT NULL DEFAULT 1,
  work_day_start TEXT NOT NULL DEFAULT '08:00',
  work_day_end TEXT NOT NULL DEFAULT '18:00',
  default_slot_duration INTEGER NOT NULL DEFAULT 60,
  zoom_level INTEGER NOT NULL DEFAULT 60,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_calendar_settings ENABLE ROW LEVEL SECURITY;

-- Users can only view their own settings
CREATE POLICY "Users can view their own calendar settings"
ON public.user_calendar_settings
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own settings
CREATE POLICY "Users can insert their own calendar settings"
ON public.user_calendar_settings
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own settings
CREATE POLICY "Users can update their own calendar settings"
ON public.user_calendar_settings
FOR UPDATE
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_user_calendar_settings_updated_at
BEFORE UPDATE ON public.user_calendar_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();