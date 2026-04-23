-- Team leaders: full management on performance data for users in their area

-- performance_reviews
CREATE POLICY "Team leaders can manage team performance reviews"
ON public.performance_reviews
FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'team_leader'::app_role) AND EXISTS (
    SELECT 1 FROM profiles p
    JOIN team_leader_areas tla ON tla.user_id = auth.uid()
    WHERE p.id = performance_reviews.user_id AND p.area = tla.area
  )
)
WITH CHECK (
  has_role(auth.uid(), 'team_leader'::app_role) AND EXISTS (
    SELECT 1 FROM profiles p
    JOIN team_leader_areas tla ON tla.user_id = auth.uid()
    WHERE p.id = performance_reviews.user_id AND p.area = tla.area
  )
);

-- performance_profiles
CREATE POLICY "Team leaders can manage team performance profiles"
ON public.performance_profiles
FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'team_leader'::app_role) AND EXISTS (
    SELECT 1 FROM profiles p
    JOIN team_leader_areas tla ON tla.user_id = auth.uid()
    WHERE p.id = performance_profiles.user_id AND p.area = tla.area
  )
)
WITH CHECK (
  has_role(auth.uid(), 'team_leader'::app_role) AND EXISTS (
    SELECT 1 FROM profiles p
    JOIN team_leader_areas tla ON tla.user_id = auth.uid()
    WHERE p.id = performance_profiles.user_id AND p.area = tla.area
  )
);

-- performance_objectives
CREATE POLICY "Team leaders can manage team performance objectives"
ON public.performance_objectives
FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'team_leader'::app_role) AND EXISTS (
    SELECT 1 FROM performance_reviews pr
    JOIN profiles p ON p.id = pr.user_id
    JOIN team_leader_areas tla ON tla.user_id = auth.uid()
    WHERE pr.id = performance_objectives.review_id AND p.area = tla.area
  )
)
WITH CHECK (
  has_role(auth.uid(), 'team_leader'::app_role) AND EXISTS (
    SELECT 1 FROM performance_reviews pr
    JOIN profiles p ON p.id = pr.user_id
    JOIN team_leader_areas tla ON tla.user_id = auth.uid()
    WHERE pr.id = performance_objectives.review_id AND p.area = tla.area
  )
);

-- performance_quarterly_notes
CREATE POLICY "Team leaders can manage team quarterly notes"
ON public.performance_quarterly_notes
FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'team_leader'::app_role) AND EXISTS (
    SELECT 1 FROM performance_reviews pr
    JOIN profiles p ON p.id = pr.user_id
    JOIN team_leader_areas tla ON tla.user_id = auth.uid()
    WHERE pr.id = performance_quarterly_notes.review_id AND p.area = tla.area
  )
)
WITH CHECK (
  has_role(auth.uid(), 'team_leader'::app_role) AND EXISTS (
    SELECT 1 FROM performance_reviews pr
    JOIN profiles p ON p.id = pr.user_id
    JOIN team_leader_areas tla ON tla.user_id = auth.uid()
    WHERE pr.id = performance_quarterly_notes.review_id AND p.area = tla.area
  )
);