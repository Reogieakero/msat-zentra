"use client";

/**
 * Registrar aliases of the shared desk empty state. Keeping the local names
 * means every page-level empty renders the same centered insight callout.
 */
export {
  ZentraEmptyCard as RegistrarEmptyCard,
  ZentraEmptyState as RegistrarEmptyState,
  type ZentraEmptyCardProps as RegistrarEmptyCardProps,
} from "@/components/shared/zentra-empty-card/ZentraEmptyCard";
