-- Add status_changed_at column to projects table to track when status was last changed
ALTER TABLE public.projects 
ADD COLUMN status_changed_at timestamp with time zone DEFAULT now();

-- Create or replace function to automatically update status_changed_at when status changes
CREATE OR REPLACE FUNCTION public.update_status_changed_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only update timestamp if status has actually changed
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    NEW.status_changed_at = now();
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger to call the function on status update
DROP TRIGGER IF EXISTS trigger_update_status_changed_at ON public.projects;
CREATE TRIGGER trigger_update_status_changed_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.update_status_changed_at();