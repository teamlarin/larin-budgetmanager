-- Add title and area fields to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS title text,
ADD COLUMN IF NOT EXISTS area text;

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.title IS 'Job title (e.g., Operations Manager, CEO)';
COMMENT ON COLUMN public.profiles.area IS 'Department area (Tech, Marketing, Branding, Sales)';