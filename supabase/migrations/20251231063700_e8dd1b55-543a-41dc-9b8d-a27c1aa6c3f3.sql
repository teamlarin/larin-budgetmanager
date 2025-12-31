-- Remove the foreign key constraint on activity_time_tracking.user_id 
-- to allow time tracking for imported users (profiles without auth.users entries)
ALTER TABLE public.activity_time_tracking DROP CONSTRAINT IF EXISTS activity_time_tracking_user_id_fkey;