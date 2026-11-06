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

/* Tinted rectangle-pill classes for the category — same 500 hues as the
   colors above, tinted like the app's colored badges (border /40, bg /15,
   text 700 in light / 400 in dark). */
export const ANECDOTAL_CATEGORY_PILL_CLASSES: Record<string, string> = {
  behavioral: "border-amber-500/40 bg-amber-500/15 text-amber-700 dark:text-amber-400",
  bullying: "border-red-500/40 bg-red-500/15 text-red-700 dark:text-red-400",
  academic: "border-blue-500/40 bg-blue-500/15 text-blue-700 dark:text-blue-400",
  attendance: "border-green-500/40 bg-green-500/15 text-green-700 dark:text-green-400",
  health: "border-violet-500/40 bg-violet-500/15 text-violet-700 dark:text-violet-400",
};
export function anecdotalCategoryPillClass(category: string | null | undefined): string | undefined {
  if (!category) return undefined;
  return ANECDOTAL_CATEGORY_PILL_CLASSES[category.trim().toLowerCase()];
}

/* Badge variant per category — mirrors the tint recipe in badge.tsx
   (amber/red/blue/green exist there; violet ships with this mapping). */
export const ANECDOTAL_CATEGORY_BADGE_VARIANTS: Record<
  string,
  "amber" | "red" | "blue" | "green" | "violet"
> = {
  behavioral: "amber",
  bullying: "red",
  academic: "blue",
  attendance: "green",
  health: "violet",
};
export function anecdotalCategoryBadgeVariant(
  category: string | null | undefined,
): "amber" | "red" | "blue" | "green" | "violet" | undefined {
  if (!category) return undefined;
  return ANECDOTAL_CATEGORY_BADGE_VARIANTS[category.trim().toLowerCase()];
}
