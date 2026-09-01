"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { ShieldAlert, AlertTriangle, BookOpen, CalendarDays, MessageSquareWarning } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { Card, CardContent } from "@/components/ui/card";
import type { RiskFactor } from "../api";
import styles from "./StudentsKpiRail.module.css";

const FACTOR_META: Record<RiskFactor, { icon: React.ComponentType<{ className?: string }>; color: string }> = {
  Academic: { icon: BookOpen, color: "#b91c1c" },
  Attendance: { icon: CalendarDays, color: "#2563eb" },
  Behavioral: { icon: MessageSquareWarning, color: "#7c3aed" },
};

type Board = {
  kpis: { totalAtRiskFlags: number; highRiskStudents: number };
  factorTotals: { Academic: number; Attendance: number; Behavioral: number };
};

export function StudentsKpiRail() {
  const { data, isPending } = useQuery({
    queryKey: ["risk-board"],
    queryFn: async () => {
      const res = await apiClient.get<Board>("/api/risk/board");
      return res.data;
    },
  });

  const factors: RiskFactor[] = ["Academic", "Attendance", "Behavioral"];

  return (
    <div className={styles.rail}>
      <Card className={styles.card}>
        <CardContent className={styles.cardContent}>
          <span className={styles.statValue}>{isPending ? "—" : data?.kpis.highRiskStudents ?? 0}</span>
          <span className={styles.statLabel}>
            <ShieldAlert className={styles.statIcon} aria-hidden />
            High-risk students
          </span>
        </CardContent>
      </Card>

      <Card className={styles.card}>
        <CardContent className={styles.cardContent}>
          <span className={styles.statValue}>{isPending ? "—" : data?.kpis.totalAtRiskFlags ?? 0}</span>
          <span className={styles.statLabel}>
            <AlertTriangle className={styles.statIcon} aria-hidden />
            Total risk flags
          </span>
        </CardContent>
      </Card>

      {factors.map((f) => {
        const meta = FACTOR_META[f];
        return (
          <Card key={f} className={styles.card}>
            <CardContent className={styles.cardContent}>
              <span className={styles.factorValue} style={{ color: meta.color }}>
                {isPending ? "—" : data?.factorTotals[f] ?? 0}
              </span>
              <span className={styles.statLabel}>
                <meta.icon className={styles.statIcon} aria-hidden />
                {f} flags
              </span>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
