import * as React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import kpiStyles from "../../overview/components/kpi.module.css";

export function KpiCard({
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
    <div className={kpiStyles.kpi} onMouseMove={handleMove}>
      <span className={kpiStyles.kpiIconWrap}>{icon}</span>
      <dd className={kpiStyles.kpiValue}>
        {loading ? <Skeleton className={kpiStyles.kpiSkeleton} /> : value}
      </dd>
      <dt className={kpiStyles.kpiLabel}>{label}</dt>
      <dd className={kpiStyles.kpiDescription}>{description}</dd>
    </div>
  );
}
