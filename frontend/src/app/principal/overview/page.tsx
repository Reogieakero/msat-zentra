"use client";

import * as React from "react";
import {
  Users,
  GraduationCap,
  ClipboardList,
  AlertTriangle,
  CalendarOff,
  LineChart,
  NotebookPen,
  ArrowRight,
} from "lucide-react";
import styles from "./overview.module.css";

type RiskFactors = {
  attendance: number;
  grades: number;
  behavior: number;
  wellbeing: number;
};

type OverviewData = {
  schoolName: string;
  kpis: {
    enrollment: number;
    activeSections: number;
    teachers: number;
    anecdotals: number;
  };
  atRisk: RiskFactors;
};

const MOCK: OverviewData = {
  schoolName: "Mati School of Arts and Trades",
  kpis: {
    enrollment: 1284,
    activeSections: 36,
    teachers: 58,
    anecdotals: 312,
  },
  atRisk: {
    attendance: 47,
    grades: 63,
    behavior: 28,
    wellbeing: 12,
  },
};

export default function PrincipalOverviewPage() {
  const data = MOCK;

  const totalAtRisk =
    data.atRisk.attendance +
    data.atRisk.grades +
    data.atRisk.behavior +
    data.atRisk.wellbeing;

  const riskRows: {
    key: keyof RiskFactors;
    label: string;
    icon: React.ReactNode;
    hint: string;
  }[] = [
    {
      key: "attendance",
      label: "Attendance",
      icon: <CalendarOff className={styles.riskIcon} aria-hidden />,
      hint: "Below 80% present",
    },
    {
      key: "grades",
      label: "Grades",
      icon: <LineChart className={styles.riskIcon} aria-hidden />,
      hint: "Subject average below 75",
    },
    {
      key: "behavior",
      label: "Anecdotal Records",
      icon: <NotebookPen className={styles.riskIcon} aria-hidden />,
      hint: "Behavioral entries logged",
    },
  ];

  return (
    <section className={styles.page}>
      <div className={styles.grid}>
        {/* Card 1 — School + KPIs */}
        <article className={styles.schoolCard}>
          <div className={styles.schoolHead}>
            <h2 className={styles.schoolName}>{data.schoolName}</h2>
          </div>

          <dl className={styles.kpiGrid}>
            <Kpi
              icon={<Users className={styles.kpiIcon} aria-hidden />}
              value={data.kpis.enrollment.toLocaleString()}
              label="Enrolled Students"
              description="Total learners officially enrolled and attending across all grade levels this term."
            />
            <Kpi
              icon={<GraduationCap className={styles.kpiIcon} aria-hidden />}
              value={data.kpis.activeSections.toLocaleString()}
              label="Active Sections"
              description="Sections currently running with assigned advisers and an active class schedule."
            />
            <Kpi
              icon={<ClipboardList className={styles.kpiIcon} aria-hidden />}
              value={data.kpis.teachers.toLocaleString()}
              label="Teachers"
              description="Faculty members on the active roster, including subject teachers and advisory staff."
            />
            <Kpi
              icon={<NotebookPen className={styles.kpiIcon} aria-hidden />}
              value={data.kpis.anecdotals.toLocaleString()}
              label="Anecdotal Records"
              description="Behavioral and observational entries filed by teachers and guidance this term."
            />
          </dl>
        </article>

        {/* Card 2 — At Risk */}
        <article className={styles.riskCard}>
          <div className={styles.riskHead}>
            <span className={styles.riskBadge}>
              <AlertTriangle className={styles.riskBadgeIcon} aria-hidden />
            </span>
            <div>
              <h2 className={styles.riskTitle}>At Risk</h2>
              <p className={styles.riskSub}>
                {totalAtRisk.toLocaleString()} students across tracked factors
              </p>
            </div>
          </div>

          <ul className={styles.riskList}>
            {riskRows.map((row) => (
              <li key={row.key} className={styles.riskRow}>
                <span className={styles.riskRowIcon}>{row.icon}</span>
                <span className={styles.riskRowBody}>
                  <span className={styles.riskRowLabel}>{row.label}</span>
                  <span className={styles.riskRowHint}>{row.hint}</span>
                </span>
                <span className={styles.riskRowValue}>
                  {(data.atRisk[row.key] as number).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>

          <a className={styles.riskLink} href="/principal/risk">
            Open risk center
            <ArrowRight className={styles.riskLinkIcon} aria-hidden />
          </a>
        </article>
      </div>
    </section>
  );
}

function Kpi({
  icon,
  value,
  label,
  description,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
  description: string;
}) {
  const handleMove = (e: React.MouseEvent<HTMLElement>) => {
    const card = e.currentTarget;
    const rect = card.getBoundingClientRect();
    card.style.setProperty("--mx", `${e.clientX - rect.left}px`);
    card.style.setProperty("--my", `${e.clientY - rect.top}px`);
  };

  return (
    <div className={styles.kpi} onMouseMove={handleMove}>
      <span className={styles.kpiIconWrap}>{icon}</span>
      <dd className={styles.kpiValue}>{value}</dd>
      <dt className={styles.kpiLabel}>{label}</dt>
      <dd className={styles.kpiDescription}>{description}</dd>
    </div>
  );
}
