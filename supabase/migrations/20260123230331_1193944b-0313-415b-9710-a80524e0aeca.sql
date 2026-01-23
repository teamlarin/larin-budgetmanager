-- Create table for team leader area assignments
CREATE TABLE public.team_leader_areas (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    area TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(user_id, area)
);

-- Enable RLS
ALTER TABLE public.team_leader_areas ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Admins can manage all team leader areas"
ON public.team_leader_areas
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() AND role = 'admin'
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() AND role = 'admin'
    )
);

CREATE POLICY "Team leaders can view their own areas"
ON public.team_leader_areas
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Create index for faster lookups
CREATE INDEX idx_team_leader_areas_user_id ON public.team_leader_areas(user_id);
CREATE INDEX idx_team_leader_areas_area ON public.team_leader_areas(area);