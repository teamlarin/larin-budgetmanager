type Discipline = 
  | "content_creation_storytelling"
  | "paid_advertising_media_buying"
  | "website_landing_page_development"
  | "brand_identity_visual_design"
  | "social_media_management"
  | "email_marketing_automation"
  | "seo_content_optimization"
  | "crm_customer_data_platform"
  | "software_development_integration"
  | "ai_implementation_automation"
  | "strategic_consulting";

export const DISCIPLINE_LABELS: Record<Discipline, string> = {
  content_creation_storytelling: "Content Creation & Storytelling",
  paid_advertising_media_buying: "Paid Advertising & Media Buying",
  website_landing_page_development: "Website & Landing Page Development",
  brand_identity_visual_design: "Brand Identity & Visual Design",
  social_media_management: "Social Media Management",
  email_marketing_automation: "Email Marketing & Marketing Automation",
  seo_content_optimization: "SEO & Content Optimization",
  crm_customer_data_platform: "CRM & Customer Data Platform",
  software_development_integration: "Software Development & Integration",
  ai_implementation_automation: "AI Implementation & Automation",
  strategic_consulting: "Strategic Consulting",
};

export const DISCIPLINE_COLORS: Record<Discipline, string> = {
  content_creation_storytelling: "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20",
  paid_advertising_media_buying: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20",
  website_landing_page_development: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20",
  brand_identity_visual_design: "bg-pink-500/10 text-pink-700 dark:text-pink-400 border-pink-500/20",
  social_media_management: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border-cyan-500/20",
  email_marketing_automation: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/20",
  seo_content_optimization: "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20",
  crm_customer_data_platform: "bg-teal-500/10 text-teal-700 dark:text-teal-400 border-teal-500/20",
  software_development_integration: "bg-violet-500/10 text-violet-700 dark:text-violet-400 border-violet-500/20",
  ai_implementation_automation: "bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-400 border-fuchsia-500/20",
  strategic_consulting: "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20",
};

export const getDisciplineColor = (discipline: Discipline): string => {
  return DISCIPLINE_COLORS[discipline] || DISCIPLINE_COLORS.strategic_consulting;
};

export const getDisciplineLabel = (discipline: Discipline): string => {
  return DISCIPLINE_LABELS[discipline] || discipline;
};
