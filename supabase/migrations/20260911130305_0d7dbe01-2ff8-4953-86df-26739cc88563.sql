ALTER TABLE public.budgets ADD COLUMN customer_satisfaction_auto boolean NOT NULL DEFAULT true;
ALTER TABLE public.projects ADD COLUMN customer_satisfaction_auto boolean NOT NULL DEFAULT true;