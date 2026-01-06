-- Aggiungi colonna per percentuale produttività target
ALTER TABLE public.profiles 
ADD COLUMN target_productivity_percentage numeric DEFAULT 80;

-- Commento descrittivo
COMMENT ON COLUMN public.profiles.target_productivity_percentage IS 'Percentuale target di ore su progetti fatturabili rispetto al totale ore';