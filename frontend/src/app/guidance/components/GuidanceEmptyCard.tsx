"use client";
import {
  ZentraEmptyCard,
  ZentraEmptyState,
  type ZentraEmptyCardProps,
} from "@/components/shared/zentra-empty-card/ZentraEmptyCard";

export function GuidanceEmptyState(props: ZentraEmptyCardProps) {
  return <ZentraEmptyState {...props} />;
}

export function GuidanceEmptyCard(props: ZentraEmptyCardProps) {
  return <ZentraEmptyCard {...props} />;
}
