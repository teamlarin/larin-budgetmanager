INSERT INTO public.client_contact_clients (contact_id, client_id, is_primary)
SELECT cc.id, cc.client_id, false FROM public.client_contacts cc
WHERE cc.client_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.client_contact_clients j WHERE j.contact_id = cc.id AND j.client_id = cc.client_id);