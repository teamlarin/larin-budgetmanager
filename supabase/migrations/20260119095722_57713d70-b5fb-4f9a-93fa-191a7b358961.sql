-- Create client_payment_splits table to handle default payment splits per client
CREATE TABLE public.client_payment_splits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  payment_mode_id UUID NOT NULL REFERENCES public.payment_modes(id) ON DELETE RESTRICT,
  percentage NUMERIC NOT NULL CHECK (percentage > 0 AND percentage <= 100),
  payment_term_id UUID REFERENCES public.payment_terms(id) ON DELETE SET NULL,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.client_payment_splits ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view payment splits
CREATE POLICY "Authenticated users can view client payment splits" 
ON public.client_payment_splits 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

-- Editors and admins can manage payment splits
CREATE POLICY "Editors can manage client payment splits" 
ON public.client_payment_splits 
FOR ALL 
USING (public.is_editor_or_admin(auth.uid()));

-- Create trigger for updated_at
CREATE TRIGGER update_client_payment_splits_updated_at
BEFORE UPDATE ON public.client_payment_splits
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();