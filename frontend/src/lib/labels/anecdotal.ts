export const ANECDOTAL_CATEGORY_COLORS: Record<string, string> = {
  behavioral: "#f59e0b",
  bullying: "#ef4444",
  academic: "#3b82f6",
  attendance: "#22c55e",
  health: "#8b5cf6",
};
export function anecdotalCategoryColor(category: string | null | undefined): string | undefined {
  if (!category) return undefined;
  return ANECDOTAL_CATEGORY_COLORS[category.trim().toLowerCase()];
}
