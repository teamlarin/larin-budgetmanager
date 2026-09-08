ALTER TABLE public.user_contract_periods
  DROP CONSTRAINT IF EXISTS user_contract_periods_user_id_fkey;

ALTER TABLE public.user_contract_periods
  ADD CONSTRAINT user_contract_periods_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;