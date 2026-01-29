-- Create user action logs table
CREATE TABLE public.user_action_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  action_type TEXT NOT NULL,
  action_description TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  metadata JSONB DEFAULT '{}',
  ip_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for efficient querying
CREATE INDEX idx_user_action_logs_created_at ON public.user_action_logs(created_at DESC);
CREATE INDEX idx_user_action_logs_user_id ON public.user_action_logs(user_id);

-- Enable RLS
ALTER TABLE public.user_action_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view logs
CREATE POLICY "Admins can view all user action logs"
ON public.user_action_logs
FOR SELECT
USING (public.is_admin(auth.uid()));

-- Any authenticated user can insert their own logs
CREATE POLICY "Users can insert their own action logs"
ON public.user_action_logs
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Create function to clean up old logs (older than 7 days)
CREATE OR REPLACE FUNCTION public.cleanup_old_action_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM public.user_action_logs
  WHERE created_at < NOW() - INTERVAL '7 days';
END;
$$;

-- Create a trigger to auto-cleanup on insert (simple approach)
CREATE OR REPLACE FUNCTION public.trigger_cleanup_old_logs()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Run cleanup occasionally (every ~100 inserts based on random chance)
  IF random() < 0.01 THEN
    PERFORM public.cleanup_old_action_logs();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER cleanup_old_logs_trigger
AFTER INSERT ON public.user_action_logs
FOR EACH STATEMENT
EXECUTE FUNCTION public.trigger_cleanup_old_logs();