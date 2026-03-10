
-- Table to map HubSpot owner IDs to local profile user IDs
CREATE TABLE public.hubspot_owner_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hubspot_owner_id text NOT NULL UNIQUE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.hubspot_owner_mappings ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Approved users can view owner mappings"
  ON public.hubspot_owner_mappings FOR SELECT
  TO authenticated
  USING (is_approved_user(auth.uid()));

CREATE POLICY "Admins can manage owner mappings"
  ON public.hubspot_owner_mappings FOR ALL
  TO authenticated
  USING (is_admin(auth.uid()));
