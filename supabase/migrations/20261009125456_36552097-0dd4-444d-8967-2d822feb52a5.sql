UPDATE public.performance_profiles SET team = lower(team) WHERE team IS NOT NULL AND team <> lower(team);
UPDATE public.budgets SET area = lower(area) WHERE area IS NOT NULL AND area <> lower(area);