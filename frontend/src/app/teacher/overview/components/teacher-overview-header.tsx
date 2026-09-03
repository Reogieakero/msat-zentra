"use client";

import * as React from "react";
import {
  PolarGrid,
  RadialBar,
  RadialBarChart,
} from "recharts";
import { BookOpen, GraduationCap, Users } from "lucide-react";
import type { AdvisorySectionInfo } from "./teacher-overview-data";
import styles from "./teacher-overview-header.module.css";

interface TeacherOverviewHeaderProps {
  teacherName: string;
  advisorySection?: AdvisorySectionInfo | null;
  classCount?: number;
  studentCount?: number;
  atRiskFactors?: {
    academic: number;
    attendance: number;
    behavioral: number;
  };
}

const RISK_COLORS = ["#f59e0b", "#2563eb", "#ef4444"];

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
}: {
  factors: { academic: number; attendance: number; behavioral: number };
  total: number;
}) {
  const safeTotal = total > 0 ? total : 1;
  const data = [
    { name: "Academic", value: (factors.academic / safeTotal) * 100, count: factors.academic, fill: RISK_COLORS[0] },
    { name: "Attendance", value: (factors.attendance / safeTotal) * 100, count: factors.attendance, fill: RISK_COLORS[1] },
    { name: "Behavioral", value: (factors.behavioral / safeTotal) * 100, count: factors.behavioral, fill: RISK_COLORS[2] },
  ];
  const pct =
    total > 0
      ? Math.round(((factors.academic + factors.attendance + factors.behavioral) / total) * 100)
      : 0;

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
          <PolarGrid
            cx={70}
            cy={70}
            innerRadius={38}
            outerRadius={62}
            gridType="circle"
            stroke="var(--border)"
          />
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
  atRiskFactors,
}: TeacherOverviewHeaderProps) {
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

  const riskFactors = atRiskFactors ?? { academic: 0, attendance: 0, behavioral: 0 };
  const riskTotal =
    riskFactors.academic + riskFactors.attendance + riskFactors.behavioral;

  return (
    <article className={styles.profile}>
      <div className={styles.profileBody}>
        <div className={styles.identityBlock}>
          <div className={styles.avatar} aria-hidden>
            <span className={styles.avatarInitials}>{initials || "T"}</span>
          </div>

          <div className={styles.identity}>
            <h1 className={styles.heroTitle}>{teacherName}</h1>
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
        </div>

        <div className={styles.profileFoot}>
          <StatChip icon={BookOpen} label="Classes" value={String(classCount)} />
          <span className={styles.statDivider} aria-hidden />
          <StatChip icon={Users} label="Students" value={String(studentCount)} />
          <span className={styles.statDivider} aria-hidden />
          <StatChip
            icon={GraduationCap}
            label="Advisory"
            value={advisorySection?.name ?? "No"}
          />
        </div>
      </div>

      {isAdviser ? (
        <aside
          className={styles.populationPanel}
          aria-label="Section population and at-risk factors"
        >
          <div className={styles.chartsRow}>
            <section className={styles.chartColumn}>
              <header className={styles.sectionHead}>
                <h2 className={styles.sectionTitle}>Advisory Section</h2>
                <span className={styles.sectionMeta}>
                  {advisorySection?.gradeLevel} · {advisorySection?.name}
                </span>
              </header>
              <div className={styles.populationBody}>
                <div className={styles.populationStat}>
                  <span className={styles.populationValue}>{studentCount}</span>
                  <span className={styles.populationCaption}>students</span>
                </div>
              </div>
            </section>

            <section className={styles.chartColumn}>
              <header className={styles.sectionHead}>
                <h2 className={styles.sectionTitle}>At-Risk Factors</h2>
                <span className={styles.sectionMeta}>
                  {riskTotal} of {studentCount}
                </span>
              </header>
              <AtRiskRadial factors={riskFactors} total={studentCount} />
            </section>
          </div>
        </aside>
      ) : null}
    </article>
  );
}
