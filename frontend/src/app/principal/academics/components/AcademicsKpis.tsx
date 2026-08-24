"use client";

import * as React from "react";
import {
  Users,
  GraduationCap,
  ShieldAlert,
  Award,
  Sparkles,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type {
  SectionSummary,
  HonorRollCandidate,
  PotentialHonorCandidate,
} from "../mockData";
import styles from "./AcademicsKpis.module.css";

export type KpiFocus = "honor" | "potential";

interface Props {
  sections: SectionSummary[];
  honorRollPreview: HonorRollCandidate[];
  potentialHonorRoll: PotentialHonorCandidate[];
  loading: boolean;
  focus?: KpiFocus | null;
  onSelectKpi?: (key: KpiFocus) => void;
}

function useTotals(sections: SectionSummary[]) {
  return React.useMemo(() => {
    const students = sections.flatMap((s) => s.students);
    const totalStudents = students.length;
    const atRisk = students.filter(
      (s) => s.riskLevel === "High" || s.riskLevel === "Moderate"
    ).length;
    const avgTransmuted =
      sections.length > 0
        ? Math.round(
            (sections.reduce((a, s) => a + s.avgTransmuted, 0) / sections.length) *
              10
          ) / 10
        : 0;
    return { totalStudents, atRisk, avgTransmuted };
  }, [sections]);
}

export function AcademicsKpis({
  sections,
  honorRollPreview,
  potentialHonorRoll,
  loading,
  focus,
  onSelectKpi,
}: Props) {
  const { totalStudents, atRisk, avgTransmuted } = useTotals(sections);

  const items: {
    key?: KpiFocus;
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    value: string;
  }[] = [
    { icon: Users, label: "Students", value: totalStudents.toString() },
    { icon: GraduationCap, label: "Avg Transmuted", value: avgTransmuted.toFixed(1) },
    { icon: ShieldAlert, label: "At-Risk", value: atRisk.toString() },
    {
      key: "honor",
      icon: Award,
      label: "Honor Roll",
      value: honorRollPreview.length.toString(),
    },
    {
      key: "potential",
      icon: Sparkles,
      label: "Potential Honor",
      value: potentialHonorRoll.length.toString(),
    },
  ];

  return (
    <div className={styles.kpiGrid}>
      {items.map((it) => {
        const Icon = it.icon;
        const clickable = Boolean(it.key) && Boolean(onSelectKpi);
        const active = it.key && focus === it.key;
        return (
          <button
            type="button"
            key={it.label}
            disabled={!clickable}
            onClick={() => it.key && onSelectKpi?.(it.key)}
            className={`${styles.kpi} ${clickable ? styles.kpiClickable : ""} ${
              active ? styles.kpiActive : ""
            }`}
          >
            <Icon className={styles.kpiIcon} aria-hidden />
            {loading ? (
              <Skeleton className={`${styles.kpiValue} ${styles.kpiValueSkeleton}`} />
            ) : (
              <p className={styles.kpiValue}>{it.value}</p>
            )}
            <p className={styles.kpiLabel}>{it.label}</p>
          </button>
        );
      })}
    </div>
  );
}
