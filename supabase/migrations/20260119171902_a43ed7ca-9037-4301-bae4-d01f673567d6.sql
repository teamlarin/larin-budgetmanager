-- Modify clients table: remove address, add account_user_id and strategic_level
ALTER TABLE public.clients 
DROP COLUMN IF EXISTS address;

ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS account_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS strategic_level INTEGER DEFAULT 2 CHECK (strategic_level >= 1 AND strategic_level <= 3);

-- Add comment for clarity
COMMENT ON COLUMN public.clients.strategic_level IS '1 = Alto, 2 = Medio, 3 = Basso';