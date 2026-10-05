CREATE TABLE public.user_expected_hours_overrides (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  month DATE NOT NULL,
  expected_hours NUMERIC NOT NULL,
  reason TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, month)
);

GRANT SELECT ON public.user_expected_hours_overrides TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.user_expected_hours_overrides TO authenticated;
GRANT ALL ON public.user_expected_hours_overrides TO service_role;

ALTER TABLE public.user_expected_hours_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read expected hours overrides"
ON public.user_expected_hours_overrides
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admin and finance can insert expected hours overrides"
ON public.user_expected_hours_overrides
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'finance'));

CREATE POLICY "Admin and finance can update expected hours overrides"
ON public.user_expected_hours_overrides
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'finance'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'finance'));

CREATE POLICY "Admin and finance can delete expected hours overrides"
ON public.user_expected_hours_overrides
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'finance'));

CREATE OR REPLACE FUNCTION public.update_user_expected_hours_overrides_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_user_expected_hours_overrides_updated_at
BEFORE UPDATE ON public.user_expected_hours_overrides
FOR EACH ROW
EXECUTE FUNCTION public.update_user_expected_hours_overrides_updated_at();