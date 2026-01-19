-- Create table for HubSpot field mappings
CREATE TABLE public.hubspot_field_mappings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('company', 'contact')),
  hubspot_field TEXT NOT NULL,
  hubspot_field_label TEXT,
  local_field TEXT NOT NULL,
  local_field_label TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(entity_type, hubspot_field)
);

-- Enable RLS
ALTER TABLE public.hubspot_field_mappings ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to manage mappings
CREATE POLICY "Authenticated users can view mappings" 
ON public.hubspot_field_mappings 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage mappings" 
ON public.hubspot_field_mappings 
FOR ALL 
USING (public.is_admin(auth.uid()));

-- Insert default mappings for companies
INSERT INTO public.hubspot_field_mappings (entity_type, hubspot_field, hubspot_field_label, local_field, local_field_label) VALUES
('company', 'name', 'Nome azienda', 'name', 'Ragione Sociale'),
('company', 'domain', 'Dominio', 'email', 'Email (da dominio)'),
('company', 'phone', 'Telefono', 'phone', 'Telefono'),
('company', 'description', 'Descrizione', 'notes', 'Note');

-- Insert default mappings for contacts
INSERT INTO public.hubspot_field_mappings (entity_type, hubspot_field, hubspot_field_label, local_field, local_field_label) VALUES
('contact', 'firstname', 'Nome', 'first_name', 'Nome'),
('contact', 'lastname', 'Cognome', 'last_name', 'Cognome'),
('contact', 'email', 'Email', 'email', 'Email'),
('contact', 'phone', 'Telefono', 'phone', 'Telefono'),
('contact', 'jobtitle', 'Ruolo', 'role', 'Ruolo'),
('contact', 'hs_notes_body', 'Note', 'notes', 'Note');

-- Add updated_at trigger
CREATE TRIGGER update_hubspot_field_mappings_updated_at
BEFORE UPDATE ON public.hubspot_field_mappings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();