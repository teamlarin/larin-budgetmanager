-- Create table to track user activity completions
CREATE TABLE public.user_activity_completions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  budget_item_id UUID NOT NULL REFERENCES public.budget_items(id) ON DELETE CASCADE,
  completed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, budget_item_id)
);

-- Enable RLS
ALTER TABLE public.user_activity_completions ENABLE ROW LEVEL SECURITY;

-- Users can view their own completions
CREATE POLICY "Users can view their own completions"
ON public.user_activity_completions
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own completions
CREATE POLICY "Users can insert their own completions"
ON public.user_activity_completions
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can delete their own completions
CREATE POLICY "Users can delete their own completions"
ON public.user_activity_completions
FOR DELETE
USING (auth.uid() = user_id);

-- Add index for faster lookups
CREATE INDEX idx_user_activity_completions_user_id ON public.user_activity_completions(user_id);
CREATE INDEX idx_user_activity_completions_budget_item_id ON public.user_activity_completions(budget_item_id);