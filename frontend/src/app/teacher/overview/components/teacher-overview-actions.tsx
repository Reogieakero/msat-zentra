"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";
import styles from "./teacher-overview-actions.module.css";

export interface QuickAction {
  title: string;
  description: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface TeacherOverviewActionsProps {
  actions: QuickAction[];
  /** Compact 2-per-row tiles for the narrow sidebar rail. */
  compact?: boolean;
  /** Single row of 4 cards (main column). */
  row?: boolean;
}

export function TeacherOverviewActions({ actions, compact = false, row = false }: TeacherOverviewActionsProps) {
  return (
    <section aria-label="Quick actions" className={`${styles.section} ${compact ? styles.compact : ""} ${row ? styles.row : ""}`}>
      <div className={styles.head}>
        <h2 className={styles.title}>Start your day</h2>
        <p className={styles.subtitle}>
          Jump straight into today&apos;s classroom tasks.
        </p>
      </div>
      <div
        className={styles.grid}
        style={row ? { gridTemplateColumns: "repeat(4, minmax(0, 1fr))" } : undefined}
      >
        {actions.map((action) => (
          <div key={action.title} className={assign.card}>
            <span className={assign.glowClip} aria-hidden="true">
              <span className={assign.cardGlow} />
            </span>
            <span className={`${styles.iconRow} relative`}>
              <span className={styles.iconWrap} aria-hidden>
                <action.icon className={styles.icon} />
              </span>
            </span>
            <span className={`${styles.text} relative`}>
              <span className={styles.cardTitle}>{action.title}</span>
              <span className={styles.cardDesc}>{action.description}</span>
            </span>
            <span className={`${styles.cardBtn} relative`}>
              <Button asChild variant="outline" size="sm">
                <Link href={action.href}>Open</Link>
              </Button>
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
