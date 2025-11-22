-- Create table for discipline-area mappings
CREATE TABLE public.discipline_area_mappings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  discipline TEXT NOT NULL,
  areas TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(discipline)
);

-- Enable RLS
ALTER TABLE public.discipline_area_mappings ENABLE ROW LEVEL SECURITY;

-- Policies for discipline_area_mappings
CREATE POLICY "Anyone can view discipline mappings"
ON public.discipline_area_mappings
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Only admins can insert discipline mappings"
ON public.discipline_area_mappings
FOR INSERT
TO authenticated
WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Only admins can update discipline mappings"
ON public.discipline_area_mappings
FOR UPDATE
TO authenticated
USING (is_admin(auth.uid()));

CREATE POLICY "Only admins can delete discipline mappings"
ON public.discipline_area_mappings
FOR DELETE
TO authenticated
USING (is_admin(auth.uid()));

-- Add trigger for updated_at
CREATE TRIGGER update_discipline_area_mappings_updated_at
BEFORE UPDATE ON public.discipline_area_mappings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default mappings
INSERT INTO public.discipline_area_mappings (discipline, areas) VALUES
  ('content_creation_storytelling', ARRAY['marketing', 'branding']),
  ('paid_advertising_media_buying', ARRAY['marketing']),
  ('website_landing_page_development', ARRAY['tech']),
  ('brand_identity_visual_design', ARRAY['branding']),
  ('social_media_management', ARRAY['marketing']),
  ('email_marketing_automation', ARRAY['marketing', 'tech']),
  ('seo_content_optimization', ARRAY['marketing', 'tech']),
  ('crm_customer_data_platform', ARRAY['sales', 'tech']),
  ('software_development_integration', ARRAY['tech']),
  ('ai_implementation_automation', ARRAY['tech']),
  ('strategic_consulting', ARRAY['marketing', 'sales', 'branding', 'tech']);