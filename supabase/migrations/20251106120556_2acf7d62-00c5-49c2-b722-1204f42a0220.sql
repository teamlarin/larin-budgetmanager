-- Create new discipline enum with the 11 disciplines
CREATE TYPE public.discipline AS ENUM (
  'content_creation_storytelling',
  'paid_advertising_media_buying',
  'website_landing_page_development',
  'brand_identity_visual_design',
  'social_media_management',
  'email_marketing_automation',
  'seo_content_optimization',
  'crm_customer_data_platform',
  'software_development_integration',
  'ai_implementation_automation',
  'strategic_consulting'
);

-- Add new discipline column to budget_templates
ALTER TABLE public.budget_templates 
ADD COLUMN discipline public.discipline;

-- Migrate existing data (map old areas to new disciplines)
UPDATE public.budget_templates
SET discipline = CASE
  WHEN area = 'marketing' THEN 'social_media_management'::discipline
  WHEN area = 'tech' THEN 'software_development_integration'::discipline
  WHEN area = 'branding' THEN 'brand_identity_visual_design'::discipline
  WHEN area = 'sales' THEN 'strategic_consulting'::discipline
  ELSE 'strategic_consulting'::discipline
END;

-- Make discipline NOT NULL after migration
ALTER TABLE public.budget_templates
ALTER COLUMN discipline SET NOT NULL;

-- Drop old area column
ALTER TABLE public.budget_templates
DROP COLUMN area;

-- Add new discipline column to services table
ALTER TABLE public.services
ADD COLUMN discipline public.discipline;

-- Make discipline NOT NULL with default
ALTER TABLE public.services
ALTER COLUMN discipline SET DEFAULT 'strategic_consulting'::discipline;