-- Create table to store Fatture in Cloud OAuth tokens
CREATE TABLE public.fic_oauth_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expiry TIMESTAMP WITH TIME ZONE NOT NULL,
  company_id INTEGER NOT NULL,
  company_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.fic_oauth_tokens ENABLE ROW LEVEL SECURITY;

-- Only admins can view/manage tokens
CREATE POLICY "Only admins can view FIC tokens"
  ON public.fic_oauth_tokens
  FOR SELECT
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Only admins can insert FIC tokens"
  ON public.fic_oauth_tokens
  FOR INSERT
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Only admins can update FIC tokens"
  ON public.fic_oauth_tokens
  FOR UPDATE
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Only admins can delete FIC tokens"
  ON public.fic_oauth_tokens
  FOR DELETE
  USING (public.is_admin(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_fic_oauth_tokens_updated_at
  BEFORE UPDATE ON public.fic_oauth_tokens
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();