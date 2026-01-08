-- Create table for client contacts
CREATE TABLE public.client_contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  role TEXT,
  email TEXT,
  phone TEXT,
  notes TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.client_contacts ENABLE ROW LEVEL SECURITY;

-- Create policies (inherit access from parent client)
CREATE POLICY "Approved users can view client contacts" 
ON public.client_contacts 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM clients 
    WHERE clients.id = client_contacts.client_id 
    AND is_approved_user(auth.uid())
  )
);

CREATE POLICY "Approved users can insert client contacts" 
ON public.client_contacts 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM clients 
    WHERE clients.id = client_contacts.client_id 
    AND is_approved_user(auth.uid())
  )
);

CREATE POLICY "Approved users can update client contacts" 
ON public.client_contacts 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM clients 
    WHERE clients.id = client_contacts.client_id 
    AND is_approved_user(auth.uid())
  )
);

CREATE POLICY "Approved users can delete client contacts" 
ON public.client_contacts 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM clients 
    WHERE clients.id = client_contacts.client_id 
    AND is_approved_user(auth.uid())
  )
);

-- Create index for efficient queries
CREATE INDEX idx_client_contacts_client_id ON public.client_contacts(client_id);

-- Create trigger to update updated_at
CREATE TRIGGER update_client_contacts_updated_at
BEFORE UPDATE ON public.client_contacts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();