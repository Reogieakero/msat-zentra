import * as React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import styles from "./kpi.module.css";

export function Kpi({
  icon,
  value,
  label,
  description,
  loading = false,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
  description: string;
  loading?: boolean;
}) {
  const handleMove = (e: React.MouseEvent<HTMLElement>) => {
    const card = e.currentTarget;
    const rect = card.getBoundingClientRect();
    card.style.setProperty("--mx", `${e.clientX - rect.left}px`);
    card.style.setProperty("--my", `${e.clientY - rect.top}px`);
  };

  return (
    <div className={styles.kpi} onMouseMove={handleMove}>
      <span className={styles.kpiIconWrap}>{icon}</span>
      <dd className={styles.kpiValue}>
        {loading ? <Skeleton className={styles.kpiSkeleton} /> : value}
      </dd>
      <dt className={styles.kpiLabel}>{label}</dt>
      <dd className={styles.kpiDescription}>{description}</dd>
    </div>
  );
}
