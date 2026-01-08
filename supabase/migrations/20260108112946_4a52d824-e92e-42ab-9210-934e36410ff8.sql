-- Create table for user contract history
CREATE TABLE public.user_contract_periods (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  hourly_rate NUMERIC NOT NULL DEFAULT 0,
  contract_type TEXT NOT NULL DEFAULT 'full-time',
  contract_hours NUMERIC NOT NULL DEFAULT 0,
  contract_hours_period TEXT NOT NULL DEFAULT 'monthly',
  target_productivity_percentage NUMERIC NOT NULL DEFAULT 80,
  start_date DATE NOT NULL,
  end_date DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_contract_periods ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Admins can view all contract periods" 
ON public.user_contract_periods 
FOR SELECT 
USING (is_admin(auth.uid()));

CREATE POLICY "Admins can insert contract periods" 
ON public.user_contract_periods 
FOR INSERT 
WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admins can update contract periods" 
ON public.user_contract_periods 
FOR UPDATE 
USING (is_admin(auth.uid()));

CREATE POLICY "Admins can delete contract periods" 
ON public.user_contract_periods 
FOR DELETE 
USING (is_admin(auth.uid()));

CREATE POLICY "Users can view their own contract periods" 
ON public.user_contract_periods 
FOR SELECT 
USING (auth.uid() = user_id);

-- Create index for efficient queries
CREATE INDEX idx_user_contract_periods_user_date ON public.user_contract_periods(user_id, start_date DESC);

-- Create a function to get the hourly rate for a user at a specific date
CREATE OR REPLACE FUNCTION public.get_user_hourly_rate_at_date(
  p_user_id UUID,
  p_date DATE DEFAULT CURRENT_DATE
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rate NUMERIC;
BEGIN
  SELECT hourly_rate INTO v_rate
  FROM user_contract_periods
  WHERE user_id = p_user_id
    AND start_date <= p_date
    AND (end_date IS NULL OR end_date >= p_date)
  ORDER BY start_date DESC
  LIMIT 1;
  
  -- Fallback to profiles table if no contract period found
  IF v_rate IS NULL THEN
    SELECT hourly_rate INTO v_rate
    FROM profiles
    WHERE id = p_user_id;
  END IF;
  
  RETURN COALESCE(v_rate, 0);
END;
$$;

-- Create trigger to update updated_at
CREATE TRIGGER update_user_contract_periods_updated_at
BEFORE UPDATE ON public.user_contract_periods
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();