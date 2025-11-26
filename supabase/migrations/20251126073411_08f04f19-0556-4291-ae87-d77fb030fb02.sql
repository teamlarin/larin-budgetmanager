-- Create activity_time_tracking table for calendar and time tracking
CREATE TABLE IF NOT EXISTS public.activity_time_tracking (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  budget_item_id UUID NOT NULL REFERENCES public.budget_items(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  scheduled_date DATE,
  scheduled_start_time TIME,
  scheduled_end_time TIME,
  actual_start_time TIMESTAMPTZ,
  actual_end_time TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.activity_time_tracking ENABLE ROW LEVEL SECURITY;

-- Policies: Users can only see and manage their own time tracking
CREATE POLICY "Users can view their own time tracking"
  ON public.activity_time_tracking
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own time tracking"
  ON public.activity_time_tracking
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own time tracking"
  ON public.activity_time_tracking
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own time tracking"
  ON public.activity_time_tracking
  FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_activity_time_tracking_updated_at
  BEFORE UPDATE ON public.activity_time_tracking
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster queries
CREATE INDEX idx_activity_time_tracking_user_date 
  ON public.activity_time_tracking(user_id, scheduled_date);

CREATE INDEX idx_activity_time_tracking_budget_item 
  ON public.activity_time_tracking(budget_item_id);