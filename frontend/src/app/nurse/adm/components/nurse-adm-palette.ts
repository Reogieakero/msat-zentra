/**
 * Amber chart palette for the nurse ADM page — one scale shared by every
 * graph (donut slices, bars, category/level ramps). Mirrors the clinic
 * overview's amber (tailwind amber-500 with stepped transparency).
 */
export const AMBER = "oklch(0.769 0.188 70.08)"; // amber-500

export const AMBER_STEPS = [
  AMBER,
  `color-mix(in oklch, ${AMBER}, transparent 25%)`,
  `color-mix(in oklch, ${AMBER}, transparent 45%)`,
  `color-mix(in oklch, ${AMBER}, transparent 60%)`,
  `color-mix(in oklch, ${AMBER}, transparent 72%)`,
  `color-mix(in oklch, ${AMBER}, transparent 82%)`,
  `color-mix(in oklch, ${AMBER}, transparent 89%)`,
];
