"use client";
import type * as React from "react";
import type { LucideIcon } from "lucide-react";
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";
import styles from "./CoordinatorEmptyCard.module.css";

type CoordinatorEmptyCardProps = {
  icon: LucideIcon;
  title: string;
  hint: string;
  label?: string;
  action?: React.ReactNode;
  centered?: boolean;
};

export function CoordinatorEmptyState({ icon: Icon, title, hint, action }: CoordinatorEmptyCardProps) {
  return (
    <div className={`${styles.emptyBlock} relative`}>
      <span className={styles.emptyIcon} aria-hidden="true">
        <Icon />
      </span>
      <p className={styles.emptyTitle}>{title}</p>
      <p className={styles.emptyHint}>{hint}</p>
      {action ? <div className={styles.emptyAction}>{action}</div> : null}
    </div>
  );
}

export function CoordinatorEmptyCard({ icon: Icon, title, hint, label, action, centered }: CoordinatorEmptyCardProps) {
  if (centered) {
    return (
      <div className={styles.emptyWrap}>
        <section className={`${assign.card} ${styles.emptyCenterCard}`} aria-label={label ?? title}>
          <span className={assign.glowClip} aria-hidden="true">
            <span className={assign.cardGlow} />
          </span>
          <CoordinatorEmptyState icon={Icon} title={title} hint={hint} action={action} />
        </section>
      </div>
    );
  }
  return (
    <section className={assign.card} aria-label={label ?? title}>
      <span className={assign.glowClip} aria-hidden="true">
        <span className={assign.cardGlow} />
      </span>
      <CoordinatorEmptyState icon={Icon} title={title} hint={hint} action={action} />
    </section>
  );
}
