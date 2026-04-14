
-- 1. performance_reviews
CREATE TABLE public.performance_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  year integer NOT NULL,
  compiled_by uuid REFERENCES public.profiles(id),
  compilation_period text,
  job_title text,
  team text,
  team_leader_name text,
  start_date date,
  contract_history text,
  compensation text,
  contract_type text,
  career_target_role text,
  career_long_term_goal text,
  company_support text,
  strengths text,
  improvement_areas text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, year)
);

ALTER TABLE public.performance_reviews ENABLE ROW LEVEL SECURITY;

-- User sees own
CREATE POLICY "Users can view own performance reviews"
  ON public.performance_reviews FOR SELECT
  USING (auth.uid() = user_id);

-- Admin sees all
CREATE POLICY "Admins can manage performance reviews"
  ON public.performance_reviews FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Team leader sees team members (via area match)
CREATE POLICY "Team leaders can view team performance reviews"
  ON public.performance_reviews FOR SELECT
  USING (
    has_role(auth.uid(), 'team_leader'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.team_leader_areas tla ON tla.user_id = auth.uid()
      WHERE p.id = performance_reviews.user_id
        AND p.area = tla.area
    )
  );

-- Trigger for updated_at
CREATE TRIGGER update_performance_reviews_updated_at
  BEFORE UPDATE ON public.performance_reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. performance_objectives
CREATE TABLE public.performance_objectives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES public.performance_reviews(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  bonus_percentage numeric DEFAULT 0,
  sort_order integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.performance_objectives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own performance objectives"
  ON public.performance_objectives FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.performance_reviews pr
    WHERE pr.id = performance_objectives.review_id AND pr.user_id = auth.uid()
  ));

CREATE POLICY "Admins can manage performance objectives"
  ON public.performance_objectives FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Team leaders can view team performance objectives"
  ON public.performance_objectives FOR SELECT
  USING (
    has_role(auth.uid(), 'team_leader'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.performance_reviews pr
      JOIN public.profiles p ON p.id = pr.user_id
      JOIN public.team_leader_areas tla ON tla.user_id = auth.uid()
      WHERE pr.id = performance_objectives.review_id
        AND p.area = tla.area
    )
  );

CREATE TRIGGER update_performance_objectives_updated_at
  BEFORE UPDATE ON public.performance_objectives
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. performance_quarterly_notes
CREATE TABLE public.performance_quarterly_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES public.performance_reviews(id) ON DELETE CASCADE,
  quarter text NOT NULL CHECK (quarter IN ('Q1','Q2','Q3','Q4')),
  notes text,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(review_id, quarter)
);

ALTER TABLE public.performance_quarterly_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own quarterly notes"
  ON public.performance_quarterly_notes FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.performance_reviews pr
    WHERE pr.id = performance_quarterly_notes.review_id AND pr.user_id = auth.uid()
  ));

CREATE POLICY "Admins can manage quarterly notes"
  ON public.performance_quarterly_notes FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Team leaders can view team quarterly notes"
  ON public.performance_quarterly_notes FOR SELECT
  USING (
    has_role(auth.uid(), 'team_leader'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.performance_reviews pr
      JOIN public.profiles p ON p.id = pr.user_id
      JOIN public.team_leader_areas tla ON tla.user_id = auth.uid()
      WHERE pr.id = performance_quarterly_notes.review_id
        AND p.area = tla.area
    )
  );

CREATE TRIGGER update_performance_quarterly_notes_updated_at
  BEFORE UPDATE ON public.performance_quarterly_notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
