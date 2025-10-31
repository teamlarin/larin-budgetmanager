-- Create quotes table to store generated quotes
CREATE TABLE public.quotes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  quote_number TEXT NOT NULL,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  discount_percentage NUMERIC DEFAULT 0,
  margin_percentage NUMERIC DEFAULT 0,
  discounted_total NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  generated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own quotes"
ON public.quotes
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own quotes"
ON public.quotes
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own quotes"
ON public.quotes
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own quotes"
ON public.quotes
FOR DELETE
USING (auth.uid() = user_id);

CREATE POLICY "Only approved users can access quotes"
ON public.quotes
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.approved = true
  )
);

-- Create trigger for updated_at
CREATE TRIGGER update_quotes_updated_at
BEFORE UPDATE ON public.quotes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();