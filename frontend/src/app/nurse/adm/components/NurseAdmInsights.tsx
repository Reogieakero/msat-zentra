"use client";

import * as React from "react";
import {
  Activity,
  CalendarClock,
  Hourglass,
  ListChecks,
  Send,
  type LucideIcon,
} from "lucide-react";
import { KanbanBoard } from "@/components/ui/kanban-board";
import { StudentMascot } from "@/components/student-mascot/StudentMascot";
import type {
  NurseAdmInsightsData,
  NurseAdmRecommendation,
} from "@/services/nurse/adm.reports";
import { AdmInterpretation } from "./NurseAdmInterpretation";
import { AdmNumberText } from "./NurseAdmNumberText";
import {
  SECTION_PILL,
  STAT_PILL,
  STUDENT_PILL,
  TYPE_PILL,
  TYPE_TONE,
} from "./nurse-adm-pills";
import styles from "./nurse-adm.module.css";

/* Per-KPI icon + accent — same coloured-icon language as the overview KPI
   rail, so the findings strip reads as the same family of boards. */
const FINDING_META: Record<string, { icon: LucideIcon; accent: string }> = {
  total: { icon: Activity, accent: "text-primary" },
  awaiting: { icon: Hourglass, accent: "text-amber-500" },
  waiting: { icon: CalendarClock, accent: "text-orange-500" },
  endorsed: { icon: Send, accent: "text-blue-500" },
};

/** KPI stats strip — one kanban board per finding, plus optional extras. */
export function NurseAdmStats({
  data,
  extra,
}: {
  data: NurseAdmInsightsData;
  extra?: React.ReactNode;
}) {
  return (
    <div className={styles.findings} role="status" aria-label="Key findings">
      {data.findings.map((f) => {
        const meta = FINDING_META[f.key] ?? FINDING_META.total;
        const Icon = meta.icon;
        return (
          <KanbanBoard
            key={f.key}
            title={f.label}
            icon={
              <span className={meta.accent} aria-hidden>
                <Icon size={14} />
              </span>
            }
            description={<span className={STAT_PILL}>{f.hint}</span>}
            className="flex-1"
          >
            <p className={styles.findingValue}>{f.value}</p>
          </KanbanBoard>
        );
      })}
      {extra}
    </div>
  );
}

function formatDays(days: number | null): string {
  return days === null ? "—" : `${days.toFixed(1)}d`;
}

function Bottlenecks({ data }: { data: NurseAdmInsightsData }) {
  const { longestDays, avgDays, measured } = data.response;
  const message =
    (measured === 0
      ? "Response times will appear once cases show recorded handling."
      : `Your response measured over ${measured} handled case${measured === 1 ? "" : "s"}. `) +
    (data.bottlenecks.length === 0
      ? "No backlog — new referrals will surface here by waiting time."
      : "Decide the longest-waiting cases before newer arrivals to keep the pipeline fair.");
  return (
    <KanbanBoard
      title="Waiting bottlenecks"
      icon={
        <span className="text-orange-500" aria-hidden>
          <Hourglass size={14} />
        </span>
      }
      count={data.bottlenecks.length}
      description="Longest-waiting cases still needing action, clinic and ADM."
      className="flex-1"
      footer={<AdmInterpretation>{message}</AdmInterpretation>}
    >
      <div className={styles.responseStats} role="status" aria-label="Nurse response times">
        <div className={styles.responseStat}>
          <span className={styles.responseValue}>{formatDays(longestDays)}</span>
          <span className={styles.responseLabel}>Longest response</span>
        </div>
        <div className={styles.responseStat}>
          <span className={styles.responseValue}>{formatDays(avgDays)}</span>
          <span className={styles.responseLabel}>Average response</span>
        </div>
      </div>
      {data.bottlenecks.length === 0 ? (
        <p className={styles.empty}>Nothing waiting — the queue is clear.</p>
      ) : (
        <ol className={styles.bottleneckList}>
          {data.bottlenecks.map((b) => (
            <li key={b.id}>
              <a
                className={styles.bottleneckRow}
                href={`/nurse/referrals/${b.kind === "ADM" ? "adm" : "clinic"}?highlight=${b.id}`}
              >
                <span className={styles.bottleneckMain}>
                  <span className={styles.bottleneckName}>
                    {b.kind ? (
                      <span
                        className={`${TYPE_PILL} ${
                          TYPE_TONE[b.kind] ??
                          "border-border bg-secondary text-secondary-foreground"
                        }`}
                      >
                        {b.kind}
                      </span>
                    ) : null}
                    <span className="shrink-0" aria-hidden>
                      <StudentMascot
                        name={b.student}
                        seed={b.student}
                        size={28}
                      />
                    </span>
                    <span className={STUDENT_PILL} title={b.student}>
                      {b.student}
                    </span>
                    {b.section ? (
                      <span className={SECTION_PILL} title={b.section}>
                        {b.section}
                      </span>
                    ) : null}
                  </span>
                  {b.reason ? (
                    <span className={styles.bottleneckReason}>{b.reason}</span>
                  ) : null}
                </span>
                <span className={styles.bottleneckDays}>
                  {b.waitingDays}d waiting
                </span>
              </a>
            </li>
          ))}
        </ol>
      )}
    </KanbanBoard>
  );
}

function RecommendationRow({ rec }: { rec: NurseAdmRecommendation }) {
  const body = (
    <>
      <span className={styles.recMain}>
        <span className={styles.recTitle}>
          <AdmNumberText>{rec.title}</AdmNumberText>
        </span>
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
}

function Recommendations({ data }: { data: NurseAdmInsightsData }) {
  return (
    <KanbanBoard
      title="Recommended actions"
      icon={
        <span className="text-primary" aria-hidden>
          <ListChecks size={14} />
        </span>
      }
      count={data.recommendations.length}
      description="What to do next, derived from your live caseload."
      className="flex-1"
    >
      {data.recommendations.length === 0 ? (
        <p className={styles.empty}>
          {data.total === 0
            ? "Recommendations will appear here once cases are referred to you."
            : "You're all caught up — nothing needs action."}
        </p>
      ) : (
        <ul className={styles.recList}>
          {data.recommendations.map((rec) => (
            <RecommendationRow key={rec.key} rec={rec} />
          ))}
        </ul>
      )}
    </KanbanBoard>
  );
}

/** Bottlenecks + recommendations — the boards that sit below the charts. */
export function NurseAdmInsights({ data }: { data: NurseAdmInsightsData }) {
  return (
    <div className={styles.grid}>
      <Bottlenecks data={data} />
      <Recommendations data={data} />
    </div>
  );
}
