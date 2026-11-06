"use client";
import type * as React from "react";
import type { LucideIcon } from "lucide-react";
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";
import styles from "./ZentraEmptyCard.module.css";

export type ZentraEmptyCardProps = {
  icon: LucideIcon;
  title: string;
  hint: string;
  label?: string;
  action?: React.ReactNode;
  centered?: boolean;
  /**
   * Accent for the icon chip. `neutral` (default) is the quiet grey chip;
   * `amber` marks a desk-accent empty state (e.g. a chart with no data yet).
   */
  tone?: "neutral" | "amber";
  /**
   * "viewport" (default): centered wrapper sizes itself to the viewport.
   * "fit": centered wrapper has no min-height — the parent provides the
   * height (use with a fit-to-viewport page section so empty pages never
   * scroll from the wrapper alone).
   */
  layout?: "viewport" | "fit";
};

export function ZentraEmptyState({
  icon: Icon,
  title,
  hint,
  action,
  tone = "neutral",
}: ZentraEmptyCardProps) {
  return (
    <div className={`${styles.emptyBlock} relative`}>
      <span
        className={`${styles.emptyIcon} ${tone === "amber" ? styles.emptyIconAmber : ""}`}
        aria-hidden="true"
      >
        <Icon />
      </span>
      <p className={styles.emptyTitle}>{title}</p>
      <p className={styles.emptyHint}>{hint}</p>
      {action ? <div className={styles.emptyAction}>{action}</div> : null}
    </div>
  );
}

export function ZentraEmptyCard({ icon, title, hint, label, action, centered, tone, layout }: ZentraEmptyCardProps) {
  if (centered) {
    return (
      <div className={layout === "fit" ? styles.emptyFit : styles.emptyWrap}>
        <section className={`${assign.card} ${styles.emptyCenterCard}`} aria-label={label ?? title}>
          <span className={assign.glowClip} aria-hidden="true">
            <span className={assign.cardGlow} />
          </span>
          <ZentraEmptyState icon={icon} title={title} hint={hint} action={action} tone={tone} />
        </section>
      </div>
    );
  }
  return (
    <section className={assign.card} aria-label={label ?? title}>
      <span className={assign.glowClip} aria-hidden="true">
        <span className={assign.cardGlow} />
      </span>
      <ZentraEmptyState icon={icon} title={title} hint={hint} action={action} tone={tone} />
    </section>
  );
}
