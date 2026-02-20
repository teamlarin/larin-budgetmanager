
-- Create junction table for many-to-many contact-client relationship
CREATE TABLE public.client_contact_clients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id UUID NOT NULL REFERENCES public.client_contacts(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(contact_id, client_id)
);

-- Enable RLS
ALTER TABLE public.client_contact_clients ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Approved users can view contact-client assignments"
ON public.client_contact_clients FOR SELECT
USING (is_approved_user(auth.uid()));

CREATE POLICY "Approved users can insert contact-client assignments"
ON public.client_contact_clients FOR INSERT
WITH CHECK (is_approved_user(auth.uid()));

CREATE POLICY "Approved users can update contact-client assignments"
ON public.client_contact_clients FOR UPDATE
USING (is_approved_user(auth.uid()));

CREATE POLICY "Approved users can delete contact-client assignments"
ON public.client_contact_clients FOR DELETE
USING (is_approved_user(auth.uid()));

-- Migrate existing data from client_contacts into junction table
INSERT INTO public.client_contact_clients (contact_id, client_id, is_primary)
SELECT id, client_id, is_primary FROM public.client_contacts
WHERE client_id IS NOT NULL;

-- Make client_id nullable on client_contacts (keep for backward compat)
ALTER TABLE public.client_contacts ALTER COLUMN client_id DROP NOT NULL;
