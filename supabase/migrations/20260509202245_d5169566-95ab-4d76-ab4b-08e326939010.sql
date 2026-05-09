
-- 1. profiles.jethr_employee_id
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS jethr_employee_id TEXT UNIQUE;

-- 2. user_contract_periods.source
ALTER TABLE public.user_contract_periods
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual';

-- 3. jethr_absences
CREATE TABLE IF NOT EXISTS public.jethr_absences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jethr_id TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  hours NUMERIC,
  status TEXT NOT NULL DEFAULT 'approved',
  notes TEXT,
  raw JSONB,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_jethr_absences_user_dates
  ON public.jethr_absences(user_id, start_date, end_date);

ALTER TABLE public.jethr_absences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own jethr absences"
  ON public.jethr_absences FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'team_leader')
  );

-- 4. jethr_pending_requests
CREATE TABLE IF NOT EXISTS public.jethr_pending_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jethr_id TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  hours NUMERIC,
  status TEXT NOT NULL DEFAULT 'pending',
  submitted_at TIMESTAMPTZ,
  notes TEXT,
  raw JSONB,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_jethr_pending_user
  ON public.jethr_pending_requests(user_id, start_date);

ALTER TABLE public.jethr_pending_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own pending; admins/leaders see all"
  ON public.jethr_pending_requests FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'team_leader')
  );

-- 5. jethr_holidays
CREATE TABLE IF NOT EXISTS public.jethr_holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jethr_id TEXT UNIQUE,
  date DATE NOT NULL,
  name TEXT NOT NULL,
  is_company_closure BOOLEAN NOT NULL DEFAULT false,
  raw JSONB,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(date, name)
);

ALTER TABLE public.jethr_holidays ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read holidays"
  ON public.jethr_holidays FOR SELECT TO authenticated
  USING (true);
