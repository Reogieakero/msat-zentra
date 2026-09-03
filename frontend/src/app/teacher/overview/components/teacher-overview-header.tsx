"use client";

import * as React from "react";
import { useSession } from "@/lib/auth/useSession";
import { Badge } from "@/components/ui/badge";
import styles from "./teacher-overview.module.css";

export function TeacherOverviewHeader() {
  const session = useSession();

  const displayName = session?.sub ? `Teacher ${session.sub.slice(0, 8)}` : "Teacher";
  const isAdviser = session?.role === "adviser";
  const roleLabel = isAdviser ? "Adviser" : "Subject Teacher";

  return (
    <header className={styles.header}>
      <div className={styles.titleRow}>
        <h1 className={styles.heading}>Teacher Overview</h1>
        <Badge variant={isAdviser ? "default" : "outline"} className={styles.badge}>
          {roleLabel}
        </Badge>
      </div>
      <p className={styles.subtitle}>
        Welcome back, {displayName}. Here is your teaching load and recent activity.
      </p>
      <div className={styles.metaRow}>
        <span className={styles.metaItem}>SY 2026-2027</span>
        <span className={styles.metaDot} aria-hidden />
        <span className={styles.metaItem}>Term 1</span>
      </div>
    </header>
  );
}