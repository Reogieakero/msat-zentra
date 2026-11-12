"use client";

/**
 * Coordinator aliases of the shared desk empty state. Keeping the local names
 * means every page-level empty renders the same centered callout.
 */
export {
  ZentraEmptyCard as CoordinatorEmptyCard,
  ZentraEmptyState as CoordinatorEmptyState,
  type ZentraEmptyCardProps as CoordinatorEmptyCardProps,
} from "@/components/shared/zentra-empty-card/ZentraEmptyCard";
