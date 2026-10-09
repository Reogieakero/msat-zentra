"use client";
import {
  ZentraEmptyCard,
  ZentraEmptyState,
  type ZentraEmptyCardProps,
} from "@/components/shared/zentra-empty-card/ZentraEmptyCard";

export function NurseEmptyState(props: ZentraEmptyCardProps) {
  return <ZentraEmptyState {...props} />;
}

export function NurseEmptyCard(props: ZentraEmptyCardProps) {
  return <ZentraEmptyCard {...props} />;
}
