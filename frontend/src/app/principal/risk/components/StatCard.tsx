import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { LucideIcon } from "lucide-react";
import styles from "./stat-card.module.css";

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  accent,
  loading = false,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
  accent?: string;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <Card size="sm" className={styles.card}>
        <CardHeader className={styles.header}>
          <Skeleton className={styles.skelTitle} />
          <Skeleton className={styles.skelIcon} />
        </CardHeader>
        <CardContent className={styles.content}>
          <Skeleton className={styles.skelValue} />
          <Skeleton className={styles.skelHint} />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card size="sm" className={styles.card}>
      <CardHeader className={styles.header}>
        <CardTitle className={styles.title}>{label}</CardTitle>
        <span
          className={styles.iconWrap}
          style={accent ? { color: accent } : undefined}
        >
          <Icon className={styles.icon} aria-hidden />
        </span>
      </CardHeader>
      <CardContent className={styles.content}>
        <span className={styles.value}>{value}</span>
        {hint ? <span className={styles.hint}>{hint}</span> : null}
      </CardContent>
    </Card>
  );
}
