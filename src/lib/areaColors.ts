type LevelArea = "marketing" | "tech" | "branding" | "sales";

export const AREA_LABELS: Record<LevelArea, string> = {
  marketing: "Marketing",
  tech: "Tech",
  branding: "Branding",
  sales: "Sales",
};

export const AREA_COLORS: Record<LevelArea, string> = {
  marketing: "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20",
  tech: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20",
  branding: "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20",
  sales: "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20",
};

export const getAreaColor = (area: LevelArea): string => {
  return AREA_COLORS[area] || AREA_COLORS.marketing;
};

export const getAreaLabel = (area: LevelArea): string => {
  return AREA_LABELS[area] || area;
};
