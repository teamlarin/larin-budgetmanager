-- Restrict direct read access to sensitive compensation columns on profiles
REVOKE SELECT (hourly_rate, contract_type, contract_hours, contract_hours_period)
  ON public.profiles FROM anon, authenticated;

-- Provide controlled access via a SECURITY DEFINER RPC
CREATE OR REPLACE FUNCTION public.get_profiles_compensation(_user_ids uuid[] DEFAULT NULL)
RETURNS TABLE(
  id uuid,
  hourly_rate numeric,
  contract_type public.contract_type,
  contract_hours numeric,
  contract_hours_period public.contract_hours_period
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_priv boolean;
BEGIN
  IF v_uid IS NULL THEN
    RETURN;
  END IF;

  v_priv := public.has_role(v_uid, 'admin'::app_role)
         OR public.has_role(v_uid, 'finance'::app_role)
         OR public.has_role(v_uid, 'team_leader'::app_role);

  RETURN QUERY
  SELECT p.id, p.hourly_rate, p.contract_type, p.contract_hours, p.contract_hours_period
  FROM public.profiles p
  WHERE (_user_ids IS NULL OR p.id = ANY(_user_ids))
    AND (v_priv OR p.id = v_uid);
END;
$$;

REVOKE ALL ON FUNCTION public.get_profiles_compensation(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_profiles_compensation(uuid[]) TO authenticated;