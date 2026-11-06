"use client";

import { Hourglass, ListChecks, type LucideIcon } from "lucide-react";
import { KanbanBoard } from "@/components/ui/kanban-board";
import { Pill, type PillTone } from "@/components/ui/pill";
import { StudentMascot } from "@/components/student-mascot/StudentMascot";
import type { AdmDashboard } from "@/services/principal/adm.types";
import { InsightCallout } from "@/components/ui/insight-callout";
import { GuidanceAdmNumberText } from "../../../guidance/adm/components/guidance-adm-number-text";
import styles from "../../../guidance/adm/components/guidance-adm.module.css";

const STAGE_META: Record<string, { label: string; tone: PillTone }> = {
  meeting_parents: { label: "Meeting", tone: "amber" },
  home_visitation: { label: "Visitation", tone: "rose" },
  certification: { label: "Certified", tone: "green" },
  principal_approval: { label: "Approval", tone: "blue" },
  enrollment_monitoring: { label: "Monitoring", tone: "violet" },
};

function BoardIcon({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <span className="text-primary" aria-hidden>
      <Icon size={14} />
    </span>
  );
}

function waitingDays(datePrepared: string | null): number | null {
  if (!datePrepared) return null;
  const prepared = new Date(`${datePrepared}T00:00:00`).getTime();
  if (!Number.isFinite(prepared)) return null;
  const days = Math.floor((Date.now() - prepared) / 86_400_000);
  return days < 0 ? 0 : days;
}

function Bottlenecks({ dashboard }: { dashboard: AdmDashboard }) {
  // Every ADM case on file counts here — endorsed, signed, or still moving
  // through the pipeline — so signed learners aren't dropped from the desk.
  const rows = dashboard.latestReferred
    .map((r) => ({ row: r, waiting: waitingDays(r.datePrepared) }))
    .filter((r): r is { row: (typeof dashboard.latestReferred)[number]; waiting: number } => r.waiting !== null)
    .sort((a, b) => b.waiting - a.waiting)
    .slice(0, 5);

  const longest = rows[0]?.waiting ?? null;
  const avg =
    rows.length === 0
      ? null
      : rows.reduce((sum, r) => sum + r.waiting, 0) / rows.length;

  const message =
    rows.length === 0
      ? "No ADM cases on file yet — endorsed and signed cases will appear here."
      : "Every ADM case on file, longest-waiting first — signed cases included.";

  return (
    <KanbanBoard
      title="Waiting bottlenecks"
      icon={
        <span className="text-orange-500" aria-hidden>
          <Hourglass size={14} />
        </span>
      }
      description="ADM cases across the pipeline — endorsed, signed, or in monitoring."
      className="flex-1"
      footer={
        <div className="mt-auto">
          <InsightCallout>
            <GuidanceAdmNumberText>{message}</GuidanceAdmNumberText>
          </InsightCallout>
        </div>
      }
    >
      <div className={styles.responseStats} role="status" aria-label="ADM waiting times">
        <div className={styles.responseStat}>
          <span className={styles.responseValue}>
            {longest === null ? "—" : `${longest}d`}
          </span>
          <span className={styles.responseLabel}>Longest waiting</span>
        </div>
        <div className={styles.responseStat}>
          <span className={styles.responseValue}>
            {avg === null ? "—" : `${avg.toFixed(1)}d`}
          </span>
          <span className={styles.responseLabel}>Average waiting</span>
        </div>
      </div>
      {rows.length === 0 ? (
        <p className={styles.boardEmpty}>Nothing waiting — the ADM queue is clear.</p>
      ) : (
        <ol className={styles.bottleneckList}>
          {rows.map(({ row, waiting }) => {
            const meta = row.approvedBy
              ? { label: "Signed", tone: "green" as PillTone }
              : (STAGE_META[row.stage] ?? {
                  label: row.stage,
                  tone: "amber" as PillTone,
                });
            return (
              <li key={row.id}>
                <a
                  className={styles.bottleneckRow}
                  href={`/principal/adm/referrals/all?q=${encodeURIComponent(row.student)}`}
                >
                  <span className={styles.bottleneckMain}>
                    <span className={styles.bottleneckName}>
                      <Pill tone={meta.tone} label="ADM stage">
                        {meta.label}
                      </Pill>
                      <span className="shrink-0" aria-hidden>
                        <StudentMascot name={row.student} seed={row.student} size={28} />
                      </span>
                      <Pill
                        tone="amber"
                        label="Student"
                        className="max-w-[10rem] truncate"
                      >
                        {row.student}
                      </Pill>
                      <Pill tone="neutral" label="Prepared by">
                        {row.preparedBy}
                      </Pill>
                    </span>
                    <span className={styles.bottleneckReason}>
                      {row.eligibilityStatus === "eligible"
                        ? "Eligibility cleared"
                        : row.eligibilityStatus === "ineligible"
                          ? "Eligibility not met"
                          : "Eligibility for review"}
                    </span>
                  </span>
                  <span className={styles.bottleneckDays}>{waiting}d waiting</span>
                </a>
              </li>
            );
          })}
        </ol>
      )}
    </KanbanBoard>
  );
}

export function AdmInsights({ dashboard }: { dashboard: AdmDashboard }) {
  // Principal actions cover both sides of the desk: endorse newly endorsed
  // cases and keep an eye on the ones already signed and under monitoring.
  const recommendations: {
    key: string;
    title: string;
    detail: string;
    count: number;
    href?: string;
  }[] = [];

  if (dashboard.kpis.pendingSignature > 0) {
    recommendations.push({
      key: "endorse",
      title: "Endorse ADM cases",
      detail: "Coordinator-endorsed cases waiting for your signature.",
      count: dashboard.kpis.pendingSignature,
      href: "/principal/adm/referrals/all?stage=principal_approval",
    });
  }
  if (dashboard.kpis.signed > 0) {
    recommendations.push({
      key: "monitor",
      title: "Monitor signed ADM cases",
      detail: "Approved learners still under their ADM arrangement.",
      count: dashboard.kpis.signed,
      href: "/principal/adm/referrals/all",
    });
  }

  return (
    <div className={styles.insightsGrid}>
      <Bottlenecks dashboard={dashboard} />
      <KanbanBoard
        title="Recommended actions"
        icon={<BoardIcon icon={ListChecks} />}
        description="Endorse new cases and keep signed ADM learners on track."
        className="flex-1"
      >
        {recommendations.length === 0 ? (
          <p className={styles.boardEmpty}>
            {dashboard.totalReferred === 0
              ? "Cases will appear here once ADM profiles are filed."
              : "Nothing needs action — you're all caught up."}
          </p>
        ) : (
          <ul className={styles.recList}>
            {recommendations.map((rec) => {
              const body = (
                <>
                  <span className={styles.recMain}>
                    <span className={styles.recTitle}>{rec.title}</span>
                    <span className={styles.recDetail}>{rec.detail}</span>
                  </span>
                  <span className={styles.recCount}>{rec.count}</span>
                </>
              );
              return (
                <li key={rec.key}>
                  {rec.href ? (
                    <a className={styles.recRow} href={rec.href}>
                      {body}
                    </a>
                  ) : (
                    <span className={styles.recRow}>{body}</span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </KanbanBoard>
    </div>
  );
}
