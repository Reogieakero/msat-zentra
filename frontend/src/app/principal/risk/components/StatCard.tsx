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
  loading = false,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
  loading?: boolean;
}) {
  const handleMove = (e: React.MouseEvent<HTMLElement>) => {
    const card = e.currentTarget;
    const rect = card.getBoundingClientRect();
    card.style.setProperty("--mx", `${e.clientX - rect.left}px`);
    card.style.setProperty("--my", `${e.clientY - rect.top}px`);
  };

  if (loading) {
    return (
      <Card size="sm" className={styles.card} onMouseMove={handleMove}>
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
    <Card size="sm" className={styles.card} onMouseMove={handleMove}>
      <CardHeader className={styles.header}>
        <CardTitle className={styles.title}>{label}</CardTitle>
        <Icon className={styles.icon} aria-hidden style={{ color: "var(--primary)" }} />
      </CardHeader>
      <CardContent className={styles.content}>
        <span className={styles.value}>{value}</span>
        {hint ? <span className={styles.hint}>{hint}</span> : null}
      </CardContent>
    </Card>
  );
}
