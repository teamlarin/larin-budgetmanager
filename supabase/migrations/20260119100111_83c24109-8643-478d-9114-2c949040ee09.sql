-- Create table for quote payment splits
CREATE TABLE public.quote_payment_splits (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    quote_id UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
    payment_mode_id UUID NOT NULL REFERENCES public.payment_modes(id) ON DELETE RESTRICT,
    payment_term_id UUID REFERENCES public.payment_terms(id) ON DELETE SET NULL,
    percentage NUMERIC NOT NULL CHECK (percentage > 0 AND percentage <= 100),
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.quote_payment_splits ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view quote payment splits"
ON public.quote_payment_splits
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM quotes q 
        WHERE q.id = quote_payment_splits.quote_id 
        AND (q.user_id = auth.uid() OR EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'account', 'finance')))
    )
);

CREATE POLICY "Users can insert quote payment splits"
ON public.quote_payment_splits
FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM quotes q 
        WHERE q.id = quote_payment_splits.quote_id 
        AND (q.user_id = auth.uid() OR EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'account', 'finance')))
    )
);

CREATE POLICY "Users can update quote payment splits"
ON public.quote_payment_splits
FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM quotes q 
        WHERE q.id = quote_payment_splits.quote_id 
        AND (q.user_id = auth.uid() OR EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'account', 'finance')))
    )
);

CREATE POLICY "Users can delete quote payment splits"
ON public.quote_payment_splits
FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM quotes q 
        WHERE q.id = quote_payment_splits.quote_id 
        AND (q.user_id = auth.uid() OR EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'account', 'finance')))
    )
);

-- Create index for faster lookups
CREATE INDEX idx_quote_payment_splits_quote_id ON public.quote_payment_splits(quote_id);

-- Add trigger for updated_at
CREATE TRIGGER update_quote_payment_splits_updated_at
    BEFORE UPDATE ON public.quote_payment_splits
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();