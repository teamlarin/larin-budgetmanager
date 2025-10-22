-- Create activity_categories table
CREATE TABLE public.activity_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  name text NOT NULL,
  areas level_area[] NOT NULL DEFAULT '{}',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.activity_categories ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Only approved users can access activity categories"
ON public.activity_categories
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.approved = true
  )
);

CREATE POLICY "Users can view their own activity categories"
ON public.activity_categories
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own activity categories"
ON public.activity_categories
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own activity categories"
ON public.activity_categories
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own activity categories"
ON public.activity_categories
FOR DELETE
USING (auth.uid() = user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_activity_categories_updated_at
BEFORE UPDATE ON public.activity_categories
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();