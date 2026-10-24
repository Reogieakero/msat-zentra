/**
 * Shared pill recipes for the nurse ADM boards — one place for the tinted
 * rectangles (KPI hints, referral type badges, student / section pills) so
 * every board reads the same way.
 */
export const STAT_PILL =
  "inline-flex max-w-full items-center rounded-md border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium leading-tight text-amber-700 dark:text-amber-400";

/* Referral type badge — rectangle pill, colour-coded by type. */
export const TYPE_PILL =
  "inline-flex shrink-0 items-center rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide";
export const TYPE_TONE: Record<string, string> = {
  ADM: "border-blue-500/40 bg-blue-500/15 text-blue-700 dark:text-blue-400",
  Clinic:
    "border-green-500/40 bg-green-500/15 text-green-700 dark:text-green-400",
};

export const STUDENT_PILL =
  "inline-flex min-w-0 items-center truncate rounded-md border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold leading-tight text-amber-700 dark:text-amber-400";
export const SECTION_PILL =
  "inline-flex min-w-0 items-center truncate rounded-md border border-border bg-secondary px-2 py-0.5 text-[11px] font-medium leading-tight text-secondary-foreground";
