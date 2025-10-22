-- Allow approved users to view basic profile information of other users
CREATE POLICY "Approved users can view other users' profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND approved = true
  )
);