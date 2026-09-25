"use client";

import * as React from "react";
import Link from "next/link";
import {
  PolarGrid,
  RadialBar,
  RadialBarChart,
} from "recharts";
import { BookOpen, GraduationCap, Users } from "lucide-react";
import type { AdvisorySectionInfo, TeacherClassRow } from "./teacher-overview-data";
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
  atRiskStudents?: number;
  /** Assigned class sections, shown on the flipped face of the risk card. */
  classes?: TeacherClassRow[];
  /** Narrow 20% sidebar rail: stacks identity, advisory and risk vertically. */
  rail?: boolean;
}

const RISK_COLORS = ["#171717", "#525252", "#a3a3a3"];

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
}: {
  factors: { academic: number; attendance: number; behavioral: number };
  total: number;
  atRisk: number;
}) {
  const safeTotal = total > 0 ? total : 1;
  const data = [
    { name: "Academic", value: Math.min(100, (factors.academic / safeTotal) * 100), count: factors.academic, fill: RISK_COLORS[0] },
    { name: "Attendance", value: Math.min(100, (factors.attendance / safeTotal) * 100), count: factors.attendance, fill: RISK_COLORS[1] },
    { name: "Behavioral", value: Math.min(100, (factors.behavioral / safeTotal) * 100), count: factors.behavioral, fill: RISK_COLORS[2] },
  ];
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
  atRiskStudents = 0,
  classes = [],
  rail = false,
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
  const [showClasses, setShowClasses] = React.useState(false);

  return (
    <div className={rail ? styles.railStack : undefined}>
      <article className={`${styles.profile} ${rail ? styles.rail : ""}`}>
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
      </article>

      {isAdviser ? (
        <div className={styles.flip}>
          <div className={`${styles.flipInner} ${showClasses ? styles.flipped : ""}`}>
            <aside
              className={`${styles.populationPanel} ${rail ? styles.railPanel : ""}`}
              aria-label="At-risk factors"
            >
              <section className={styles.chartColumn}>
                <header className={styles.sectionHead}>
                  <h2 className={styles.sectionTitle}>At-Risk Factors</h2>
                  <span className={styles.sectionMeta}>
                    {atRiskStudents} of {studentCount}
                  </span>
                </header>
                <AtRiskRadial factors={riskFactors} total={studentCount} atRisk={atRiskStudents} />
                <div className={styles.flipFoot}>
                  <button
                    type="button"
                    className={styles.flipBtn}
                    onClick={() => setShowClasses(true)}
                    aria-label="Show my classes"
                  >
                    My classes
                  </button>
                </div>
              </section>
            </aside>
            <aside
              className={`${styles.populationPanel} ${rail ? styles.railPanel : ""} ${styles.flipBack}`}
              aria-label="My classes"
            >
              <section className={styles.chartColumn}>
                <header className={styles.sectionHead}>
                  <h2 className={styles.sectionTitle}>My Classes</h2>
                </header>
                {classes.length === 0 ? (
                  <p className={styles.classEmpty}>No classes assigned yet.</p>
                ) : (
                  <>
                    <ul className={styles.classList}>
                      {classes.map((c) => (
                        <li key={c.id} className={styles.classRow}>
                          <span className={styles.classText}>
                            <span className={styles.classSubject}>{c.subject}</span>
                            <span className={styles.classMeta}>
                              {c.gradeLevel} · {c.section}
                            </span>
                          </span>
                          <span className={styles.classCount}>
                            <Users aria-hidden />
                            {c.studentCount}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <div className={styles.classActions}>
                      <Link href="/teacher/attendance" className={styles.classLink}>
                        Take attendance
                      </Link>
                      <Link href="/teacher/classes" className={styles.classLink}>
                        View all
                      </Link>
                    </div>
                    <div className={styles.flipFoot}>
                      <button
                        type="button"
                        className={styles.flipBackBtn}
                        onClick={() => setShowClasses(false)}
                        aria-label="Back to at-risk factors"
                      >
                        At-risk
                      </button>
                    </div>
                  </>
                )}
              </section>
            </aside>
          </div>
        </div>
      ) : null}
    </div>
  );
}
