-- Create a security definer function to check if user is approved
CREATE OR REPLACE FUNCTION public.is_approved_user(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = _user_id
      AND approved = true
  )
$$;

-- Allow approved users to view all profiles (without infinite recursion)
CREATE POLICY "Approved users can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.is_approved_user(auth.uid()));