"use client";

import * as React from "react";
import {
  RadialBar,
  RadialBarChart,
} from "recharts";
import { BookOpen, Clock, GraduationCap, ShieldAlert, Users } from "lucide-react";
import {
  buildTimetable,
  formatRange,
  type DayConfig,
} from "@/app/teacher/schedule/components/schedule-time";
import { Badge } from "@/components/ui/badge";
import { useTeacherProfileSettings } from "@/services/settings/profile-settings";
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";
import { GRADE_GRADIENT } from "@/components/schedule/SectionScheduleCard";
import type { AdvisorySectionInfo } from "./teacher-overview-data";
import styles from "./teacher-overview-header.module.css";

interface TeacherOverviewHeaderProps {
  teacherName: string;
  advisorySection?: AdvisorySectionInfo | null;
  classCount?: number;
  studentCount?: number;
}

// Factor colors — academic amber, attendance green, behavioral blue —
// shared by the gauge segments and the legend dots.
const RISK_COLORS = ["#f59e0b", "#22c55e", "#3b82f6"];

function StatChip({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className={styles.stat}>
      <Icon className={styles.statIcon} aria-hidden />
      <div className={styles.statText}>
        <span className={styles.statValue}>{value}</span>
        <span className={styles.statLabel}>{label}</span>
      </div>
    </div>
  );
}

function AtRiskRadial({
  factors,
  total,
  atRisk,
  hideBehavioral = false,
}: {
  factors: { academic: number; attendance: number; behavioral: number };
  total: number;
  atRisk: number;
  hideBehavioral?: boolean;
}) {
  const safeTotal = total > 0 ? total : 1;
  const all = [
    { name: "Academic", value: Math.min(100, (factors.academic / safeTotal) * 100), count: factors.academic, fill: RISK_COLORS[0] },
    { name: "Attendance", value: Math.min(100, (factors.attendance / safeTotal) * 100), count: factors.attendance, fill: RISK_COLORS[1] },
    { name: "Behavioral", value: Math.min(100, (factors.behavioral / safeTotal) * 100), count: factors.behavioral, fill: RISK_COLORS[2] },
  ];
  // Regular teachers record no anecdotal — no behavioral factor, ever.
  const data = hideBehavioral ? all.slice(0, 2) : all;
  // Unique at-risk students over the section population — never the sum of
  // factor hits (one student can trip several factors), capped at 100%.
  const pct =
    total > 0 ? Math.min(100, Math.round((atRisk / safeTotal) * 100)) : 0;

  return (
    <div className={styles.riskBlock}>
      <div className={styles.riskChart}>
        <RadialBarChart
          data={data}
          width={140}
          height={140}
          cx={70}
          cy={70}
          innerRadius={38}
          outerRadius={62}
          barSize={7}
          startAngle={90}
          endAngle={-270}
        >
          <RadialBar
            dataKey="value"
            cornerRadius={6}
            background={{ fill: "var(--muted)" }}
          />
        </RadialBarChart>
        <span className={styles.riskCenter}>
          <strong>{pct}%</strong>
          <small>at risk</small>
        </span>
      </div>

      <ul className={styles.riskLegend}>
        {data.map((row) => (
          <li key={row.name} className={styles.riskLegendItem}>
            <span
              className={styles.riskLegendDot}
              style={{ background: row.fill }}
              aria-hidden
            />
            <div className={styles.riskLegendBody}>
              <div className={styles.riskLegendRow}>
                <span className={styles.riskLegendPct}>{Math.round(row.value)}%</span>
                <span className={styles.riskLegendName}>{row.name}</span>
              </div>
              <p className={styles.riskLegendCount}>
                {row.count} student{row.count === 1 ? "" : "s"}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function TeacherOverviewHeader({
  teacherName,
  advisorySection,
  classCount = 0,
  studentCount = 0,
}: TeacherOverviewHeaderProps) {
  // Attached profile photo (same upload as Settings → Profile).
  const profile = useTeacherProfileSettings();
  const photoUrl = profile.data?.photoUrl ?? null;
  const isAdviser = Boolean(advisorySection);
  const initials = React.useMemo(() => {
    const parts = teacherName
      .split(/\s+/)
      .filter(Boolean)
      .filter((p) => !/^mr\.?$|^mrs\.?$|^ms\.?$|^dr\.?$/i.test(p));
    const picks = parts.slice(0, 2);
    return (picks.length ? picks : [teacherName])
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("");
  }, [teacherName]);

  // Card background follows the advisory section's grade color
  // (G7 green, G8 amber, G9 red, G10 blue, G11 pink, G12 violet).
  const grad = advisorySection?.gradeLevel
    ? (GRADE_GRADIENT[advisorySection.gradeLevel] ?? null)
    : null;

  return (
    <article
      className={assign.card}
      aria-label="Teacher profile"
      style={
        grad
          ? {
              borderColor: `color-mix(in oklch, ${grad.from} 40%, transparent)`,
              background: `linear-gradient(135deg, color-mix(in oklch, ${grad.from} 16%, var(--card)), color-mix(in oklch, ${grad.to} 10%, var(--card)))`,
            }
          : undefined
      }
    >
      <span className={assign.glowClip} aria-hidden="true">
        <span
          className={assign.cardGlow}
          style={
            grad
              ? {
                  background: `radial-gradient(ellipse at center, color-mix(in oklch, ${grad.from} 45%, transparent), transparent 70%)`,
                }
              : undefined
          }
        />
      </span>
      <Badge
        variant="secondary"
        className={`${assign.gradeBadge} ${assign.gradeFloat}`}
        style={
          grad
            ? {
                backgroundColor: grad.from,
                color: "#ffffff",
                borderColor: "transparent",
              }
            : {
                backgroundColor: "var(--primary)",
                color: "var(--primary-foreground)",
                borderColor: "transparent",
              }
        }
      >
        {isAdviser ? "Adviser" : "Teacher"}
      </Badge>
      <div className="relative flex flex-col gap-1">
        <div className={assign.cardHead}>
          {photoUrl ? (
            <img
              src={photoUrl}
              alt={`${teacherName} profile photo`}
              className="h-11 w-11 shrink-0 rounded-full object-cover"
            />
          ) : (
            <span className={assign.avatar} aria-hidden="true">
              {initials || "T"}
            </span>
          )}
          <span className={assign.cardTitleBlock}>
            <span className={assign.fieldLabel}>Teacher</span>
            <span className={assign.itemName} title={teacherName}>
              {teacherName}
            </span>
          </span>
        </div>
        {isAdviser && advisorySection ? (
          <p className={styles.advisory}>
            <GraduationCap className={styles.advisoryIcon} aria-hidden />
            You are adviser of <span>{advisorySection.name}</span>
          </p>
        ) : (
          <p className={styles.advisoryMuted}>
            Not assigned as a section adviser this term.
          </p>
        )}
      </div>
      <div className={`${styles.profileFoot} relative`}>
        <StatChip icon={BookOpen} label="Classes" value={String(classCount)} />
        <span className={styles.statDivider} aria-hidden />
        <StatChip icon={Users} label="Students" value={String(studentCount)} />
      </div>
    </article>
  );
}

const WEEK_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];

interface UpNextSlot {
  day: number;
  period: number;
  subject: { name: string };
  section: { name: string };
}

/* Right-rail "Up next" card: the next two upcoming subjects from the
   current time (today's remaining slots first, then later this week),
   resolved against the real day-shape clock. Ticks every minute. */
export function TeacherOverviewUpNext({
  slots,
  config,
}: {
  slots: UpNextSlot[];
  config: DayConfig | null;
}) {
  // Ticks every second — the first upcoming entry carries a live countdown.
  const [now, setNow] = React.useState(() => new Date());
  React.useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1_000);
    return () => window.clearInterval(id);
  }, []);

  const entries = React.useMemo(() => {
    if (!config || slots.length === 0) return [];
    const rows = buildTimetable(config);
    const timeOf = (period: number) => {
      const row = rows.find((r) => r.kind === "period" && r.periodIndex === period);
      return row && row.kind === "period" ? { start: row.startMin, end: row.endMin } : null;
    };
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const dow = now.getDay();
    const out: {
      key: string;
      subject: string;
      section: string;
      when: string;
      startsInSec: number | null;
    }[] = [];
    for (let d = dow; d <= 5 && out.length < 2; d += 1) {
      const daySlots = slots
        .filter((s) => s.day === d)
        .map((s) => ({ slot: s, time: timeOf(s.period) }))
        .filter(
          (r): r is { slot: UpNextSlot; time: { start: number; end: number } } =>
            !!r.time && (d > dow || r.time.start > nowMin),
        )
        .sort((a, b) => a.time.start - b.time.start);
      for (const r of daySlots) {
        if (out.length >= 2) break;
        const dayLabel = d === dow ? "Today" : WEEK_DAYS[d - 1];
        const startsInSec =
          d === dow
            ? Math.max(
                0,
                r.time.start * 60 -
                  (now.getHours() * 3_600 + now.getMinutes() * 60 + now.getSeconds()),
              )
            : null;
        out.push({
          key: `${d}:${r.slot.period}:${r.slot.subject.name}:${r.slot.section.name}`,
          subject: r.slot.subject.name,
          section: r.slot.section.name,
          when: `${dayLabel} · ${formatRange(r.time.start, r.time.end)}`,
          startsInSec,
        });
      }
    }
    return out;
  }, [slots, config, now]);

  const formatCountdown = (totalSec: number): string => {
    const h = Math.floor(totalSec / 3_600);
    const m = Math.floor((totalSec % 3_600) / 60);
    const s = totalSec % 60;
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
  };

  return (
    <div className={assign.card} aria-label="Up next">
      <span className={assign.glowClip} aria-hidden="true">
        <span className={assign.cardGlow} />
      </span>
      <div className="relative flex items-center gap-3">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10"
          aria-hidden="true"
        >
          <Clock size={20} className="text-primary" />
        </span>
        <div className="min-w-0">
          <h3 className="font-semibold">Up next</h3>
          <p className="text-xs text-muted-foreground">
            Upcoming subjects from now.
          </p>
        </div>
      </div>
      <div className="relative flex flex-col gap-1.5">
        {entries.length === 0 ? (
          <p className={styles.classEmpty}>No upcoming classes scheduled.</p>
        ) : (
          entries.map((e, i) => (
            <div key={e.key} className="flex items-start justify-between gap-2">
              <span className={styles.classText}>
                <span className={styles.classSubject}>{e.subject}</span>
                <span className={styles.classMeta}>
                  {e.section} · {e.when}
                </span>
              </span>
              {i === 0 && e.startsInSec !== null ? (
                <span
                  className="shrink-0 rounded-md bg-primary/10 px-2 py-1 font-mono text-xs font-bold tabular-nums text-primary"
                  title="Starts in"
                  aria-label={`Starts in ${formatCountdown(e.startsInSec)}`}
                >
                  {formatCountdown(e.startsInSec)}
                </span>
              ) : null}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
/* Right-rail at-risk factors card: radial chart plus factor legend. */
export function TeacherOverviewRisk({
  atRiskFactors,
  atRiskStudents = 0,
  studentCount = 0,
  populationLabel = "advisees",
  hideBehavioral = false,
}: {
  atRiskFactors?: {
    academic: number;
    attendance: number;
    behavioral: number;
  };
  atRiskStudents?: number;
  studentCount?: number;
  populationLabel?: string;
  hideBehavioral?: boolean;
}) {
  const riskFactors = atRiskFactors ?? { academic: 0, attendance: 0, behavioral: 0 };
  return (
    <div className={assign.card} aria-label="At-risk factors">
      <span className={assign.glowClip} aria-hidden="true">
        <span className={assign.cardGlow} />
      </span>
      <div className="relative flex items-center gap-3">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10"
          aria-hidden="true"
        >
          <ShieldAlert size={20} className="text-primary" />
        </span>
        <div className="min-w-0">
          <h3 className="font-semibold">At-Risk Factors</h3>
          <p className="text-xs text-muted-foreground">
            {atRiskStudents} of {studentCount} {populationLabel}.
          </p>
        </div>
      </div>
      <div className="relative">
        <AtRiskRadial factors={riskFactors} total={studentCount} atRisk={atRiskStudents} hideBehavioral={hideBehavioral} />
      </div>
    </div>
  );
}
