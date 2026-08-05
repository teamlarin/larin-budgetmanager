ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS bio text,
  ADD COLUMN IF NOT EXISTS skills text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS interests text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS languages jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.hr_employees
  ADD COLUMN IF NOT EXISTS indirizzo_residenza text;

CREATE OR REPLACE FUNCTION public.get_profiles_hr_public(_user_ids uuid[] DEFAULT NULL)
RETURNS TABLE(
  profile_id uuid,
  data_nascita date,
  indirizzo_residenza text,
  data_inizio_collaborazione date,
  data_inizio date,
  sesso text,
  job_title text,
  team text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT h.profile_id, h.data_nascita, h.indirizzo_residenza,
         h.data_inizio_collaborazione, h.data_inizio, h.sesso, h.job_title, h.team
  FROM public.hr_employees h
  WHERE h.profile_id IS NOT NULL
    AND (_user_ids IS NULL OR h.profile_id = ANY(_user_ids))
    AND public.is_approved_user(auth.uid())
    AND NOT public.has_role(auth.uid(), 'external'::app_role)
$$;

REVOKE ALL ON FUNCTION public.get_profiles_hr_public(uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_profiles_hr_public(uuid[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_profiles_hr_public(uuid[]) TO authenticated;