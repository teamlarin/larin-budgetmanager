CREATE OR REPLACE FUNCTION public.get_contract_rate_periods_for_costing(_user_ids uuid[] DEFAULT NULL::uuid[])
RETURNS TABLE(user_id uuid, start_date date, end_date date, hourly_rate numeric)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RETURN;
  END IF;

  IF NOT public.is_approved_user(v_uid) THEN
    RETURN;
  END IF;

  IF public.has_role(v_uid, 'external') THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT cp.user_id, cp.start_date, cp.end_date, cp.hourly_rate
  FROM public.user_contract_periods cp
  WHERE cp.hourly_rate IS NOT NULL
    AND (_user_ids IS NULL OR cp.user_id = ANY(_user_ids))
  ORDER BY cp.user_id, cp.start_date DESC;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_contract_rate_periods_for_costing(uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_contract_rate_periods_for_costing(uuid[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_contract_rate_periods_for_costing(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_contract_rate_periods_for_costing(uuid[]) TO service_role;