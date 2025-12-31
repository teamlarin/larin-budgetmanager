-- Remove the foreign key constraint on profiles.id to allow orphan profiles for imported users
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;

-- Note: This allows creating profiles without a corresponding auth.users entry,
-- which is needed for importing timesheet data for users who no longer exist in the system