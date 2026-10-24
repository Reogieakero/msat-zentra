"use client";

/**
 * Principal aliases of the shared desk empty state. Keeping the local names
 * avoids touching ~30 call sites while every principal page renders the same
 * card Guidance, Nurse and Teacher already use.
 */
export {
  ZentraEmptyCard as PrincipalEmptyCard,
  ZentraEmptyState as PrincipalEmptyState,
  type ZentraEmptyCardProps as PrincipalEmptyCardProps,
} from "@/components/shared/zentra-empty-card/ZentraEmptyCard";
