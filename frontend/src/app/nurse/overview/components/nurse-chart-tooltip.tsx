"use client";

/**
 * Nurse overview chart tooltip. The recipe now lives in the shared
 * `components/ui/chart-tooltip` so every desk overview chart renders the
 * same tooltip; this module keeps the nurse call sites (and their
 * `NURSE_TOOLTIP_Z_INDEX` import) unchanged.
 */
export {
  ChartTooltip as NurseChartTooltip,
  CHART_TOOLTIP_WRAPPER as NURSE_TOOLTIP_Z_INDEX,
} from "@/components/ui/chart-tooltip";
export type { ChartTooltipItem } from "@/components/ui/chart-tooltip";
