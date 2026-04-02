
CREATE OR REPLACE FUNCTION public.get_profiles_by_roles(role_filter app_role[])
RETURNS TABLE (
  id uuid,
  first_name text,
  last_name text,
  email text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT p.id, p.first_name, p.last_name, p.email
  FROM profiles p
  JOIN user_roles ur ON ur.user_id = p.id
  WHERE p.approved = true
    AND p.deleted_at IS NULL
    AND ur.role = ANY(role_filter)
  ORDER BY p.first_name;
$$;
