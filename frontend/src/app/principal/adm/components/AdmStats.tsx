"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchAdmDashboard } from "../api";
import styles from "./AdmStats.module.css";

const STATS = [
  {
    key: "pendingSignature",
    label: "Pending Signature",
    description: "Cases awaiting your review and signature to proceed.",
  },
  {
    key: "signed",
    label: "Signed This Term",
    description: "Profiles you've approved and authorized for release.",
  },
  {
    key: "active",
    label: "Active Profiles",
    description: "Learners currently progressing through the ADM pipeline.",
  },
  {
    key: "total",
    label: "Total Referred",
    description: "All referrals filed since the start of the school year.",
  },
] as const;

export function AdmStats() {
  const { data, isPending } = useQuery({
    queryKey: ["adm-dashboard"],
    queryFn: ({ signal }) => fetchAdmDashboard(signal),
  });

  const getStatValue = (key: string) => {
    if (isPending) return "—";
    if (!data) return "0";
    if (key === "total") {
      return data.stageBreakdown.reduce((sum, s) => sum + s.count, 0);
    }
    return data.kpis[key as keyof typeof data.kpis] ?? 0;
  };

  return (
    <section className={styles.section}>
      <h2 className={styles.heading}>Pipeline at a glance</h2>
      <p className={styles.subtitle}>
        Track referrals, approvals, and learner progress across every stage
        of the Alternate Delivery Mode pipeline.
      </p>

      <div className={styles.grid}>
        {STATS.map((stat) => (
          <div key={stat.key} className={styles.stat}>
            <span className={styles.value}>{getStatValue(stat.key)}</span>
            <span className={styles.label}>{stat.label}</span>
            <p className={styles.description}>{stat.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
