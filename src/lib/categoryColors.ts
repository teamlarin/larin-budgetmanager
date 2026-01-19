// Unified category colors for activities across the app
// Use these constants for consistent styling in calendar, budget, projects, etc.

export const ACTIVITY_CATEGORIES = [
  'ADV',
  'AI',
  'Analisi',
  'Automation',
  'Consulenza',
  'Content',
  'Design',
  'Dev',
  'Management',
  'Off',
  'Social Media',
  'Support',
].sort() as readonly string[];

export type ActivityCategory = typeof ACTIVITY_CATEGORIES[number];

// Solid background colors (for Gantt bars, charts, etc.)
export const categoryColorsSolid: Record<string, string> = {
  ADV: 'bg-amber-500',
  AI: 'bg-violet-500',
  Analisi: 'bg-cyan-500',
  Automation: 'bg-rose-500',
  Consulenza: 'bg-indigo-500',
  Content: 'bg-orange-500',
  Design: 'bg-purple-500',
  Dev: 'bg-green-500',
  Management: 'bg-blue-500',
  Off: 'bg-stone-400',
  'Social Media': 'bg-pink-500',
  Support: 'bg-red-500',
  Altro: 'bg-slate-500',
};

// Badge/transparent variant colors (for badges with border)
export const categoryColorsBadge: Record<string, string> = {
  ADV: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20',
  AI: 'bg-violet-500/10 text-violet-700 dark:text-violet-400 border-violet-500/20',
  Analisi: 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border-cyan-500/20',
  Automation: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20',
  Consulenza: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/20',
  Content: 'bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20',
  Design: 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20',
  Dev: 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20',
  Management: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20',
  Off: 'bg-stone-400/10 text-stone-600 dark:text-stone-400 border-stone-400/20',
  'Social Media': 'bg-pink-500/10 text-pink-700 dark:text-pink-400 border-pink-500/20',
  Support: 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20',
  Altro: 'bg-slate-500/10 text-slate-700 dark:text-slate-400 border-slate-500/20',
};

// Get solid color for a category (with fallback)
export const getCategorySolidColor = (category: string): string => {
  return categoryColorsSolid[category] || categoryColorsSolid.Altro;
};

// Get badge color for a category (with fallback)
export const getCategoryBadgeColor = (category: string): string => {
  return categoryColorsBadge[category] || categoryColorsBadge.Altro;
};

// For dynamic category coloring (when category name is not predefined)
const dynamicCategoryColors: string[] = [
  'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  'bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-200',
  'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200',
  'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200',
  'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200',
  'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
  'bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200',
];

// Solid colors for dynamic categories (for legend dots, Gantt bars, etc.)
const dynamicCategorySolidColors: string[] = [
  'bg-blue-500',
  'bg-purple-500',
  'bg-green-500',
  'bg-orange-500',
  'bg-red-500',
  'bg-slate-500',
  'bg-cyan-500',
  'bg-pink-500',
  'bg-amber-500',
  'bg-teal-500',
  'bg-indigo-500',
  'bg-rose-500',
];

const getCategoryHash = (categoryName: string): number => {
  let hash = 0;
  for (let i = 0; i < categoryName.length; i++) {
    hash = categoryName.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
};

export const getDynamicCategoryColor = (categoryName: string): string => {
  const index = getCategoryHash(categoryName) % dynamicCategoryColors.length;
  return dynamicCategoryColors[index];
};

export const getDynamicCategorySolidColor = (categoryName: string): string => {
  // First check if it's a predefined category
  if (categoryColorsSolid[categoryName]) {
    return categoryColorsSolid[categoryName];
  }
  // Otherwise use dynamic color
  const index = getCategoryHash(categoryName) % dynamicCategorySolidColors.length;
  return dynamicCategorySolidColors[index];
};
