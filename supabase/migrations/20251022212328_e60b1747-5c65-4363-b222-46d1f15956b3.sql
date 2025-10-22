-- Remove the problematic policy that causes infinite recursion
DROP POLICY IF EXISTS "Approved users can view other users' profiles" ON public.profiles;