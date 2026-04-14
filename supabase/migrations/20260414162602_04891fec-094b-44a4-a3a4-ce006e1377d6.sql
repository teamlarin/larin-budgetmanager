
-- Create performance_profiles table (one row per user)
CREATE TABLE public.performance_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  job_title text,
  team text,
  team_leader_name text,
  start_date date,
  contract_type text,
  compensation text,
  contract_history text,
  career_target_role text,
  career_long_term_goal text,
  company_support text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT performance_profiles_user_id_key UNIQUE (user_id)
);

-- Enable RLS
ALTER TABLE public.performance_profiles ENABLE ROW LEVEL SECURITY;

-- Users can view their own
CREATE POLICY "Users can view own performance profile"
ON public.performance_profiles FOR SELECT
USING (auth.uid() = user_id);

-- Team leaders can view their area
CREATE POLICY "Team leaders can view team performance profiles"
ON public.performance_profiles FOR SELECT
USING (
  has_role(auth.uid(), 'team_leader'::app_role)
  AND EXISTS (
    SELECT 1 FROM profiles p
    JOIN team_leader_areas tla ON tla.user_id = auth.uid()
    WHERE p.id = performance_profiles.user_id AND p.area = tla.area
  )
);

-- Admins full access
CREATE POLICY "Admins can manage performance profiles"
ON public.performance_profiles FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Migrate existing data from most recent review per user
INSERT INTO public.performance_profiles (user_id, job_title, team, team_leader_name, start_date, contract_type, compensation, contract_history, career_target_role, career_long_term_goal, company_support)
SELECT DISTINCT ON (user_id)
  user_id, job_title, team, team_leader_name, start_date, contract_type, compensation, contract_history, career_target_role, career_long_term_goal, company_support
FROM public.performance_reviews
ORDER BY user_id, year DESC;
