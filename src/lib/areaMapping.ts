// Mapping tra discipline e aree
export const disciplineToAreas: Record<string, string[]> = {
  "content_creation_storytelling": ["marketing", "branding"],
  "paid_advertising_media_buying": ["marketing"],
  "website_landing_page_development": ["tech"],
  "brand_identity_visual_design": ["branding"],
  "social_media_management": ["marketing"],
  "email_marketing_automation": ["marketing", "tech"],
  "seo_content_optimization": ["marketing", "tech"],
  "crm_customer_data_platform": ["sales", "tech"],
  "software_development_integration": ["tech"],
  "ai_implementation_automation": ["tech"],
  "strategic_consulting": ["marketing", "sales", "branding", "tech"],
};

export const getDisciplineAreas = (discipline: string): string[] => {
  return disciplineToAreas[discipline] || [];
};
