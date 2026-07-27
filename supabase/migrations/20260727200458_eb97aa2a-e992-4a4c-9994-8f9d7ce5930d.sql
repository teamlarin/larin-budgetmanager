
CREATE OR REPLACE FUNCTION public.get_hourly_rates_for_costing(_user_ids uuid[] DEFAULT NULL::uuid[])
RETURNS TABLE(id uuid, hourly_rate numeric)
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

  RETURN QUERY
  SELECT p.id, p.hourly_rate
  FROM public.profiles p
  WHERE (_user_ids IS NULL OR p.id = ANY(_user_ids));
END;
$function$;

REVOKE ALL ON FUNCTION public.get_hourly_rates_for_costing(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_hourly_rates_for_costing(uuid[]) TO authenticated, service_role;
