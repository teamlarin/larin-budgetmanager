-- Create enum for areas
CREATE TYPE public.level_area AS ENUM ('marketing', 'tech', 'branding', 'sales');

-- Create levels table
CREATE TABLE public.levels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  hourly_rate NUMERIC NOT NULL CHECK (hourly_rate >= 0),
  area level_area NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.levels ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Only approved users can access levels"
ON public.levels
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.approved = true
  )
);

CREATE POLICY "Users can view their own levels"
ON public.levels
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own levels"
ON public.levels
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own levels"
ON public.levels
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own levels"
ON public.levels
FOR DELETE
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_levels_updated_at
BEFORE UPDATE ON public.levels
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();