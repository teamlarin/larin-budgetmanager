CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _existing record;
  _role app_role;
BEGIN
  -- Se esiste già un'anagrafica approvata con la stessa email (es. profilo storico
  -- senza login collegato), il nuovo account eredita approvazione e ruolo.
  SELECT p.id, p.first_name, p.last_name, p.approved
    INTO _existing
  FROM public.profiles p
  WHERE lower(p.email) = lower(NEW.email)
    AND p.id <> NEW.id
    AND p.deleted_at IS NULL
    AND p.approved = true
  ORDER BY p.created_at
  LIMIT 1;

  INSERT INTO public.profiles (id, email, first_name, last_name, approved)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'first_name', ''), _existing.first_name, ''),
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'last_name', ''), _existing.last_name, ''),
    COALESCE(_existing.approved, false)
  );

  IF _existing.id IS NOT NULL THEN
    SELECT role INTO _role FROM public.user_roles WHERE user_id = _existing.id LIMIT 1;
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, COALESCE(_role, 'member'));

  RETURN NEW;
END;
$function$;