
CREATE TABLE public.help_feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  source TEXT NOT NULL CHECK (source IN ('search', 'chatbot')),
  helpful BOOLEAN NOT NULL,
  query TEXT,
  context TEXT,
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_help_feedback_source_created ON public.help_feedback(source, created_at DESC);
CREATE INDEX idx_help_feedback_helpful ON public.help_feedback(helpful);

ALTER TABLE public.help_feedback ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can submit feedback
CREATE POLICY "Authenticated users can insert their feedback"
ON public.help_feedback FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Users can view their own feedback
CREATE POLICY "Users can view their own feedback"
ON public.help_feedback FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Admins can view and manage all feedback
CREATE POLICY "Admins can view all feedback"
ON public.help_feedback FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete feedback"
ON public.help_feedback FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
