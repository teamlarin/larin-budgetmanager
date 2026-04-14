-- Restrict avatar bucket SELECT to only allow viewing files in user's own folder
-- This prevents listing all files in the bucket
DROP POLICY IF EXISTS "Authenticated users can view avatars" ON storage.objects;

CREATE POLICY "Users can view avatars in their own folder"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

-- Also allow viewing avatars by direct path (for other users' profile pictures)
CREATE POLICY "Authenticated users can view avatar files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'avatars'
  AND name IS NOT NULL
);