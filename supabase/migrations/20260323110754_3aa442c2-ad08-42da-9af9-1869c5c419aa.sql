-- Change client_contacts.client_id FK from CASCADE to SET NULL
ALTER TABLE public.client_contacts
  DROP CONSTRAINT IF EXISTS client_contacts_client_id_fkey;

ALTER TABLE public.client_contacts
  ADD CONSTRAINT client_contacts_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL;

-- Change client_contact_clients.client_id FK from CASCADE to SET NULL
ALTER TABLE public.client_contact_clients
  DROP CONSTRAINT IF EXISTS client_contact_clients_client_id_fkey;

ALTER TABLE public.client_contact_clients
  ADD CONSTRAINT client_contact_clients_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL;

-- Make client_id nullable on client_contact_clients (needed for SET NULL)
ALTER TABLE public.client_contact_clients ALTER COLUMN client_id DROP NOT NULL;