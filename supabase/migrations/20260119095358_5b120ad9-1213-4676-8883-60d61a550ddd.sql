-- Create payment_modes table for different payment types (anticipo, saldo, acconto, etc.)
CREATE TABLE public.payment_modes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  value TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.payment_modes ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view active payment modes
CREATE POLICY "Authenticated users can view payment modes" 
ON public.payment_modes 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

-- Only admins can manage payment modes
CREATE POLICY "Admins can manage payment modes" 
ON public.payment_modes 
FOR ALL 
USING (public.is_admin(auth.uid()));

-- Insert default payment modes
INSERT INTO public.payment_modes (value, label, display_order) VALUES
  ('anticipo', 'Anticipo', 0),
  ('acconto', 'Acconto', 1),
  ('saldo', 'Saldo', 2),
  ('alla_consegna', 'Alla consegna', 3),
  ('rata', 'Rata', 4);

-- Create service_payment_splits table to handle multiple payment splits per service
CREATE TABLE public.service_payment_splits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  payment_mode_id UUID NOT NULL REFERENCES public.payment_modes(id) ON DELETE RESTRICT,
  percentage NUMERIC NOT NULL CHECK (percentage > 0 AND percentage <= 100),
  payment_term_id UUID REFERENCES public.payment_terms(id) ON DELETE SET NULL,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.service_payment_splits ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view payment splits
CREATE POLICY "Authenticated users can view service payment splits" 
ON public.service_payment_splits 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

-- Editors and admins can manage payment splits
CREATE POLICY "Editors can manage service payment splits" 
ON public.service_payment_splits 
FOR ALL 
USING (public.is_editor_or_admin(auth.uid()));

-- Create trigger for updated_at
CREATE TRIGGER update_payment_modes_updated_at
BEFORE UPDATE ON public.payment_modes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_service_payment_splits_updated_at
BEFORE UPDATE ON public.service_payment_splits
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();