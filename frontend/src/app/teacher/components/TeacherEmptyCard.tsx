"use client";
import {
  ZentraEmptyCard,
  ZentraEmptyState,
  type ZentraEmptyCardProps,
} from "@/components/shared/zentra-empty-card/ZentraEmptyCard";

export function TeacherEmptyState(props: ZentraEmptyCardProps) {
  return <ZentraEmptyState {...props} />;
}

export function TeacherEmptyCard(props: ZentraEmptyCardProps) {
  return <ZentraEmptyCard {...props} />;
}
