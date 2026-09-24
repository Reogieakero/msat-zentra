"use client";

import Link from "next/link";
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

  return (
    <div className={styles.kpiGrid}>
      <div className={styles.card}>
        <p className={styles.kpiLabel}>Needs attention</p>
        <p className={styles.kpiValue}>
          {!attentionReady ? "…" : (attentionTotal ?? 0)}
        </p>
        <p className={styles.kpiHint}>{attentionHint}</p>
        <button
          type="button"
          className={styles.kpiBtnSolid}
          disabled={!attentionReady || (allClear && !attentionError)}
          onClick={onReview}
        >
          Review
        </button>
      </div>
      <div className={styles.card}>
        <p className={styles.kpiLabel}>ADM cases referred to me</p>
        <p className={styles.kpiValue}>{referredToMe}</p>
        <p className={styles.kpiHint}>All referrals awaiting or in intake</p>
        <Link className={styles.kpiBtnSolid} href="/coordinator/referrals">
          Open referrals
        </Link>
      </div>
      <div className={styles.card}>
        <p className={styles.kpiLabel}>Certifications issued</p>
        <p className={styles.kpiValue}>{certificationsIssued}</p>
        <p className={styles.kpiHint}>At or past recommendation & certification</p>
        <Link className={styles.kpiBtnSolid} href="/coordinator/certifications">
          Open certifications
        </Link>
      </div>
      <div className={styles.card}>
        <p className={styles.kpiLabel}>Awaiting Principal approval</p>
        <p className={styles.kpiValue}>{awaitingPrincipal}</p>
        <p className={styles.kpiHint}>Forwarded, eligible, unsigned</p>
        <Link
          className={styles.kpiBtnSolid}
          href="/coordinator/certifications?tab=awaiting"
        >
          Track approvals
        </Link>
      </div>
      <div className={styles.card}>
        <p className={styles.kpiLabel}>Active enrolled</p>
        <p className={styles.kpiValue}>{activeEnrolled}</p>
        <p className={styles.kpiHint}>Learners in enrollment monitoring</p>
        <Link className={styles.kpiBtnSolid} href="/coordinator/enrolled">
          Open enrolled
        </Link>
      </div>
    </div>
  );
}
