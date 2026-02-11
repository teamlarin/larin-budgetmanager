
-- Create table for project progress updates
CREATE TABLE public.project_progress_updates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  progress_value NUMERIC NOT NULL,
  update_text TEXT,
  roadblocks_text TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.project_progress_updates ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Authenticated users can view progress updates"
ON public.project_progress_updates FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert progress updates"
ON public.project_progress_updates FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own progress updates"
ON public.project_progress_updates FOR DELETE
USING (auth.uid() = user_id);
