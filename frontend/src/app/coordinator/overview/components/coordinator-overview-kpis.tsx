"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import {
  AlertTriangle,
  Award,
  Clock3,
  Inbox,
  Users,
  type LucideIcon,
} from "lucide-react";
import { KanbanBoardHeader } from "@/components/ui/kanban-board";
import { StudentMascot } from "@/components/student-mascot/StudentMascot";
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

interface KpiCard {
  label: string;
  value: string;
  hint: string;
  icon: LucideIcon;
  accent: string;
  mascot: string;
  action: ReactNode;
}

/**
 * Coordinator KPI strip — kanban stat columns (tinted column, bordered
 * KanbanBoardHeader, number-first stat card with a decorative mascot chip),
 * the same board chrome the record-keeper / registrar overviews use. Each
 * column keeps its footer action so the desk still one-clicks into the queue.
 */
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

  const cards: KpiCard[] = [
    {
      label: "Needs attention",
      value: !attentionReady ? "…" : String(attentionTotal ?? 0),
      hint: attentionHint,
      icon: AlertTriangle,
      accent: "text-amber-500",
      mascot: "owl",
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
      icon: Inbox,
      accent: "text-blue-500",
      mascot: "postbot",
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
      icon: Award,
      accent: "text-emerald-600 dark:text-emerald-400",
      mascot: "scientist",
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
      icon: Clock3,
      accent: "text-primary",
      mascot: "knight",
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
      icon: Users,
      accent: "text-blue-500",
      mascot: "cap",
      action: (
        <Link className={styles.kpiBtnSolid} href="/coordinator/enrolled">
          Open enrolled
        </Link>
      ),
    },
  ];

  return (
    <section className={styles.kpiBoard} aria-label="Coordinator overview KPIs">
      <div className={styles.kpiGrid}>
        {cards.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div
              key={kpi.label}
              className={styles.kpiColumn}
              aria-label={`${kpi.label}, ${kpi.value}`}
            >
              <KanbanBoardHeader
                icon={<Icon size={14} className={kpi.accent} aria-hidden />}
                title={kpi.label}
              />
              <div className={styles.kpiStat}>
                <span className={styles.kpiStatTop}>
                  <span className={styles.kpiMascot} aria-hidden="true">
                    <StudentMascot
                      name={kpi.label}
                      character={kpi.mascot}
                      size={36}
                    />
                  </span>
                  <span
                    className={`${styles.kpiNumber} ${
                      kpi.value === "0" ? styles.kpiNumberZero : ""
                    }`}
                  >
                    {kpi.value}
                  </span>
                </span>
                <span className={styles.kpiHint}>{kpi.hint}</span>
              </div>
              <div className={styles.kpiAction}>{kpi.action}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
