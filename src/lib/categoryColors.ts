// Unified category colors for activities across the app
// Use these constants for consistent styling in calendar, budget, projects, etc.

export const ACTIVITY_CATEGORIES = ['Management', 'Design', 'Dev', 'Content', 'Support', 'Altro'] as const;

export type ActivityCategory = typeof ACTIVITY_CATEGORIES[number];

// Solid background colors (for Gantt bars, charts, etc.)
export const categoryColorsSolid: Record<string, string> = {
  Management: 'bg-blue-500',
  Design: 'bg-purple-500',
  Dev: 'bg-green-500',
  Content: 'bg-orange-500',
  Support: 'bg-red-500',
  Altro: 'bg-slate-500',
};

// Badge/transparent variant colors (for badges with border)
export const categoryColorsBadge: Record<string, string> = {
  Management: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20',
  Design: 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20',
  Dev: 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20',
  Content: 'bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20',
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
];

export const getDynamicCategoryColor = (categoryName: string): string => {
  let hash = 0;
  for (let i = 0; i < categoryName.length; i++) {
    hash = categoryName.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % dynamicCategoryColors.length;
  return dynamicCategoryColors[index];
};
