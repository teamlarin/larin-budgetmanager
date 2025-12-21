-- Create payment_terms table
CREATE TABLE public.payment_terms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  value TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.payment_terms ENABLE ROW LEVEL SECURITY;

-- Create policies - everyone can view, only admins can manage
CREATE POLICY "Anyone can view active payment terms"
  ON public.payment_terms
  FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can manage payment terms"
  ON public.payment_terms
  FOR ALL
  USING (is_admin(auth.uid()));

-- Insert default payment terms
INSERT INTO public.payment_terms (value, label, display_order) VALUES
  ('30gg DF', '30gg DF', 1),
  ('60gg DF', '60gg DF', 2),
  ('90gg DF', '90gg DF', 3),
  ('30gg FM', '30gg FM', 4),
  ('60gg FM', '60gg FM', 5),
  ('90gg FM', '90gg FM', 6),
  ('Anticipo 50%', 'Anticipo 50%', 7),
  ('Anticipo 100%', 'Anticipo 100%', 8),
  ('A consegna', 'A consegna', 9),
  ('Rimessa diretta', 'Rimessa diretta', 10);

-- Add trigger for updated_at
CREATE TRIGGER update_payment_terms_updated_at
  BEFORE UPDATE ON public.payment_terms
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();