"use client";

import {
  Activity,
  CalendarClock,
  Hourglass,
  ListChecks,
  Send,
  type LucideIcon,
} from "lucide-react";
import { KanbanBoard } from "@/components/ui/kanban-board";
import { Pill } from "@/components/ui/pill";
import { StudentMascot } from "@/components/student-mascot/StudentMascot";
import type {
  GuidanceAdmInsightsData,
  GuidanceAdmRecommendation,
} from "@/services/guidance/adm.reports";
import { GuidanceAdmInterpretation } from "./guidance-adm-interpretation";
import styles from "./guidance-adm.module.css";

/* Same coloured-icon language as the guidance overview KPI rail. */
const FINDING_META: Record<string, { icon: LucideIcon; accent: string }> = {
  total: { icon: Activity, accent: "text-primary" },
  awaiting: { icon: Hourglass, accent: "text-amber-500" },
  waiting: { icon: CalendarClock, accent: "text-orange-500" },
  endorsed: { icon: Send, accent: "text-blue-500" },
};

const STAT_PILL_MAX = "max-w-full";
const STUDENT_PILL = "max-w-[10rem] truncate";
const SECTION_PILL = "max-w-[7rem] truncate";

function typeTone(kind: string | null | undefined): "blue" | "violet" | "neutral" {
  if (kind === "ADM") return "blue";
  if (kind === "Counseling") return "violet";
  return "neutral";
}

function BoardIcon({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <span className="text-primary" aria-hidden>
      <Icon size={14} />
    </span>
  );
}

/** KPI stats strip — one kanban board per finding. */
export function GuidanceAdmStats({ data }: { data: GuidanceAdmInsightsData }) {
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
            description={
              <Pill tone="amber" label={f.label} className={STAT_PILL_MAX}>
                {f.hint}
              </Pill>
            }
            className="flex-1"
          >
            <p className={styles.findingValue}>{f.value}</p>
          </KanbanBoard>
        );
      })}
    </div>
  );
}

function formatDays(days: number | null): string {
  return days === null ? "—" : `${days.toFixed(1)}d`;
}

function Bottlenecks({ data }: { data: GuidanceAdmInsightsData }) {
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
      description="Longest-waiting cases still needing action, counseling and ADM."
      className="flex-1"
      footer={
        <GuidanceAdmInterpretation>{message}</GuidanceAdmInterpretation>
      }
    >
      <div
        className={styles.responseStats}
        role="status"
        aria-label="Guidance response times"
      >
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
        <p className={styles.boardEmpty}>Nothing waiting — the queue is clear.</p>
      ) : (
        <ol className={styles.bottleneckList}>
          {data.bottlenecks.map((b) => (
            <li key={b.id}>
              <a
                className={styles.bottleneckRow}
                href={`/guidance/referrals/${b.kind === "ADM" ? "adm" : "counseling"}?highlight=${b.id}`}
              >
                <span className={styles.bottleneckMain}>
                  <span className={styles.bottleneckName}>
                    {b.kind ? (
                      <Pill
                        tone={typeTone(b.kind)}
                        label="Referral type"
                        className="shrink-0 uppercase tracking-wide"
                      >
                        {b.kind}
                      </Pill>
                    ) : null}
                    <span className="shrink-0" aria-hidden>
                      <StudentMascot name={b.student} seed={b.student} size={28} />
                    </span>
                    <Pill
                      tone="amber"
                      label="Student"
                      className={STUDENT_PILL}
                      title={b.student}
                    >
                      {b.student}
                    </Pill>
                    {b.section ? (
                      <Pill
                        tone="neutral"
                        label="Section"
                        className={SECTION_PILL}
                        title={b.section}
                      >
                        {b.section}
                      </Pill>
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

function RecommendationRow({ rec }: { rec: GuidanceAdmRecommendation }) {
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
}

function Recommendations({ data }: { data: GuidanceAdmInsightsData }) {
  return (
    <KanbanBoard
      title="Recommended actions"
      icon={<BoardIcon icon={ListChecks} />}
      count={data.recommendations.length}
      description="What to do next, derived from your live guidance caseload."
      className="flex-1"
    >
      {data.recommendations.length === 0 ? (
        <p className={styles.boardEmpty}>
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

/** Bottlenecks + recommendations — the boards below the report charts. */
export function GuidanceAdmInsights({ data }: { data: GuidanceAdmInsightsData }) {
  return (
    <div className={styles.insightsGrid}>
      <Bottlenecks data={data} />
      <Recommendations data={data} />
    </div>
  );
}
