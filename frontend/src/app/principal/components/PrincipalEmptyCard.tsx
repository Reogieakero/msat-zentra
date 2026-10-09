"use client";
import type * as React from "react";
import type { LucideIcon } from "lucide-react";
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";
import styles from "./PrincipalEmptyCard.module.css";
type PrincipalEmptyCardProps = {
  icon: LucideIcon;
  title: string;
  hint: string;
  label?: string;
  action?: React.ReactNode;
  centered?: boolean;
};
export function PrincipalEmptyState({ icon: Icon, title, hint, action }: PrincipalEmptyCardProps) {
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
export function PrincipalEmptyCard({ icon: Icon, title, hint, label, action, centered }: PrincipalEmptyCardProps) {
  if (centered) {
    return (
      <div className={styles.emptyWrap}>
        <section className={`${assign.card} ${styles.emptyCenterCard}`} aria-label={label ?? title}>
          <span className={assign.glowClip} aria-hidden="true">
            <span className={assign.cardGlow} />
          </span>
          <PrincipalEmptyState icon={Icon} title={title} hint={hint} action={action} />
        </section>
      </div>
    );
  }
  return (
    <section className={assign.card} aria-label={label ?? title}>
      <span className={assign.glowClip} aria-hidden="true">
        <span className={assign.cardGlow} />
      </span>
      <PrincipalEmptyState icon={Icon} title={title} hint={hint} action={action} />
    </section>
  );
}
