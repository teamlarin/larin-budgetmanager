-- Add columns to track Google Calendar event linkage
ALTER TABLE public.activity_time_tracking
ADD COLUMN IF NOT EXISTS google_event_id TEXT,
ADD COLUMN IF NOT EXISTS google_event_title TEXT;

-- Create index for faster lookup of linked Google events
CREATE INDEX IF NOT EXISTS idx_activity_time_tracking_google_event_id 
ON public.activity_time_tracking(google_event_id) 
WHERE google_event_id IS NOT NULL;