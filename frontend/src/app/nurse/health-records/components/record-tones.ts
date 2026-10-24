/**
 * Shared colour language for the nurse health-record cards and their detail
 * overlay — one place for the pill tones, board-title accents, and the
 * ADM/Clinic type colours.
 */

/* Rectangle pill base — the tint comes from the TONE_* classes below. */
export const BOARD_PILL =
  "inline-flex max-w-full items-center truncate rounded-md border px-2 py-0.5 text-[11px] font-medium leading-tight";

/* Tinted tone classes for the pills (border /40, bg /15, text 700/400) —
   the same recipe as the anecdotal category pills. */
export const TONE_AMBER =
  "border-amber-500/40 bg-amber-500/15 text-amber-700 dark:text-amber-400";
export const TONE_BLUE =
  "border-blue-500/40 bg-blue-500/15 text-blue-700 dark:text-blue-400";
export const TONE_GREEN =
  "border-green-500/40 bg-green-500/15 text-green-700 dark:text-green-400";
export const TONE_RED =
  "border-red-500/40 bg-red-500/15 text-red-700 dark:text-red-400";
export const TONE_VIOLET =
  "border-violet-500/40 bg-violet-500/15 text-violet-700 dark:text-violet-400";

/** Tint for a status pill, keyed off the status badge variant. */
export function statusToneClass(variant: string): string {
  switch (variant) {
    case "success":
      return TONE_GREEN;
    case "destructive":
      return TONE_RED;
    case "secondary":
      return TONE_VIOLET;
    case "default":
      return TONE_BLUE;
    case "amber":
    default:
      return TONE_AMBER;
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
