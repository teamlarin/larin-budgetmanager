-- HR Employees table for personnel cost management
CREATE TABLE public.hr_employees (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  azienda TEXT,
  cognome TEXT,
  nome TEXT,
  job_title TEXT,
  team TEXT,
  contratto TEXT NOT NULL,
  stato TEXT NOT NULL DEFAULT 'confermato',
  ral NUMERIC NOT NULL DEFAULT 0,
  ore_freelance INTEGER,
  bp_unitario NUMERIC,
  fringe_annuale NUMERIC,
  orario TEXT DEFAULT 'FT',
  pt_perc INTEGER,
  data_nascita DATE,
  data_inizio_collaborazione DATE,
  data_inizio DATE NOT NULL,
  data_fine DATE NOT NULL DEFAULT '2099-12-31',
  sesso TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID
);

ALTER TABLE public.hr_employees ENABLE ROW LEVEL SECURITY;

-- Only admins and finance can read
CREATE POLICY "Admin and finance can view HR employees"
ON public.hr_employees FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'finance'));

CREATE POLICY "Admin and finance can insert HR employees"
ON public.hr_employees FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'finance'));

CREATE POLICY "Admin and finance can update HR employees"
ON public.hr_employees FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'finance'));

CREATE POLICY "Admin and finance can delete HR employees"
ON public.hr_employees FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'finance'));

-- updated_at trigger
CREATE TRIGGER update_hr_employees_updated_at
BEFORE UPDATE ON public.hr_employees
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_hr_employees_team ON public.hr_employees(team);
CREATE INDEX idx_hr_employees_contratto ON public.hr_employees(contratto);
CREATE INDEX idx_hr_employees_dates ON public.hr_employees(data_inizio, data_fine);