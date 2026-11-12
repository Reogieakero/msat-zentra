import type { PillTone } from "@/components/ui/pill";

/**
 * Shared colour language for the nurse health-record cards and their detail
 * overlay — one place for the pill tones, board-title accents, and the
 * ADM/Clinic type colours.
 */

/** Tint for a status pill, keyed off the status badge variant. */
export function statusPillTone(variant: string): PillTone {
  switch (variant) {
    case "success":
      return "green";
    case "destructive":
      return "red";
    case "secondary":
      return "violet";
    case "default":
      return "blue";
    case "amber":
    default:
      return "amber";
  }
}

/** Tint for an anecdotal category pill (same hues as the category colours). */
export function categoryPillTone(category: string | null | undefined): PillTone {
  switch ((category ?? "").trim().toLowerCase()) {
    case "behavioral":
      return "amber";
    case "bullying":
      return "red";
    case "academic":
      return "blue";
    case "attendance":
      return "green";
    case "health":
      return "violet";
    default:
      return "amber";
  }
}

export const TYPE_COLORS: Record<"ADM" | "Clinic", string> = {
  ADM: "#3b82f6",
  Clinic: "#22c55e",
};
export const TYPE_TONES: Record<"ADM" | "Clinic", 1 | 2 | 3 | 4 | 5> = {
  ADM: 3,
  Clinic: 2,
};

/* Accent colours for the board title's left icon. */
export const ACCENT_NOTES = "text-primary";
export const ACCENT_OUTCOME = "text-emerald-600 dark:text-emerald-400";
export const ACCENT_FILES = "text-violet-500";
export const ACCENT_CASE = "text-amber-500";
