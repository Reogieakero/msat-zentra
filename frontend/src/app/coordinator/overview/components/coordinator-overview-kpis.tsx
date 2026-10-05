"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import styles from "./coordinator-overview-kpis.module.css";

interface CoordinatorOverviewKpisProps {
  attentionTotal: number | null;
  attentionReady: boolean;
  attentionError: boolean;
  allClear: boolean;
  referredToMe: number;
  certificationsIssued: number;
  awaitingPrincipal: number;
  activeEnrolled: number;
  onReview: () => void;
}

export function CoordinatorOverviewKpis({
  attentionTotal,
  attentionReady,
  attentionError,
  allClear,
  referredToMe,
  certificationsIssued,
  awaitingPrincipal,
  activeEnrolled,
  onReview,
}: CoordinatorOverviewKpisProps) {
  const attentionHint = !attentionReady
    ? "Checking your desk"
    : attentionError
      ? "Devices unavailable — total may be low"
      : allClear
        ? "Nothing needs you"
        : "Referrals, revisions, devices";

  const cards = [
    {
      label: "Needs attention",
      value: !attentionReady ? "…" : String(attentionTotal ?? 0),
      hint: attentionHint,
      action: (
        <button
          type="button"
          className={styles.kpiBtnSolid}
          disabled={!attentionReady || (allClear && !attentionError)}
          onClick={onReview}
        >
          Review
        </button>
      ),
    },
    {
      label: "ADM cases referred to me",
      value: String(referredToMe),
      hint: "All referrals awaiting or in intake",
      action: (
        <Link className={styles.kpiBtnSolid} href="/coordinator/referrals">
          Open referrals
        </Link>
      ),
    },
    {
      label: "Certifications issued",
      value: String(certificationsIssued),
      hint: "At or past recommendation & certification",
      action: (
        <Link className={styles.kpiBtnSolid} href="/coordinator/certifications">
          Open certifications
        </Link>
      ),
    },
    {
      label: "Awaiting Principal approval",
      value: String(awaitingPrincipal),
      hint: "Forwarded, eligible, unsigned",
      action: (
        <Link
          className={styles.kpiBtnSolid}
          href="/coordinator/certifications?tab=awaiting"
        >
          Track approvals
        </Link>
      ),
    },
    {
      label: "Active enrolled",
      value: String(activeEnrolled),
      hint: "Learners in enrollment monitoring",
      action: (
        <Link className={styles.kpiBtnSolid} href="/coordinator/enrolled">
          Open enrolled
        </Link>
      ),
    },
  ];

  return (
    <div className={styles.kpiGrid}>
      {cards.map((kpi) => (
        <Card key={kpi.label} size="sm" className={styles.card}>
          <span className={styles.glowClip} aria-hidden="true">
            <span className={styles.cardGlow} />
          </span>
          <CardContent className={styles.cardBody}>
            <p className={styles.kpiLabel}>{kpi.label}</p>
            <p className={styles.kpiValue}>{kpi.value}</p>
            <p className={styles.kpiHint}>{kpi.hint}</p>
            <div className={styles.kpiAction}>{kpi.action}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
