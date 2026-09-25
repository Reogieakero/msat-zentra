"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
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
}

export function TeacherOverviewActions({ actions, compact = false }: TeacherOverviewActionsProps) {
  return (
    <section aria-label="Quick actions" className={`${styles.section} ${compact ? styles.compact : ""}`}>
      <div className={styles.head}>
        <h2 className={styles.title}>Start your day</h2>
        <p className={styles.subtitle}>
          Jump straight into today&apos;s classroom tasks.
        </p>
      </div>
      <div className={styles.grid}>
        {actions.map((action) => (
          <Link key={action.title} href={action.href} className={styles.card}>
            <span className={styles.iconWrap} aria-hidden>
              <action.icon className={styles.icon} />
            </span>
            <span className={styles.text}>
              <span className={styles.cardTitle}>{action.title}</span>
              <span className={styles.cardDesc}>{action.description}</span>
            </span>
            <ArrowRight className={styles.arrow} aria-hidden />
          </Link>
        ))}
      </div>
    </section>
  );
}
