-- Add recurrence columns to activity_time_tracking
ALTER TABLE public.activity_time_tracking 
ADD COLUMN IF NOT EXISTS is_recurring boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS recurrence_type text DEFAULT 'none' CHECK (recurrence_type IN ('none', 'daily', 'weekly', 'monthly')),
ADD COLUMN IF NOT EXISTS recurrence_end_date date,
ADD COLUMN IF NOT EXISTS recurrence_count integer,
ADD COLUMN IF NOT EXISTS recurrence_parent_id uuid REFERENCES public.activity_time_tracking(id) ON DELETE CASCADE;

-- Create index for better performance on recurring queries
CREATE INDEX IF NOT EXISTS idx_activity_time_tracking_recurrence_parent 
ON public.activity_time_tracking(recurrence_parent_id) 
WHERE recurrence_parent_id IS NOT NULL;