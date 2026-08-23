"use client";

import * as React from "react";
import {
  Users,
  GraduationCap,
  ClipboardList,
  CalendarOff,
  NotebookPen,
  FileSignature,
  FileBarChart,
  ArrowRight,
} from "lucide-react";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  PieChart as RechartsPieChart,
  Pie,
  Cell,
} from "recharts";
import styles from "./overview.module.css";

type AnecdotalCategory = {
  key: string;
  label: string;
  value: number;
  color: string;
};

type AnecdotalStudent = {
  lrn: string;
  section: string;
  year: string;
  dateAdded: string;
  adviser: string;
};

const ANECDOTAL_CATEGORIES: AnecdotalCategory[] = [
  { key: "behavioral", label: "Behavioral", value: 132, color: "#166534" },
  { key: "bullying", label: "Bullying", value: 64, color: "#b91c1c" },
  { key: "academic", label: "Academic", value: 58, color: "#1d4ed8" },
  { key: "attendance", label: "Attendance", value: 38, color: "#c2410c" },
  { key: "health", label: "Health", value: 20, color: "#7c3aed" },
];

const categoryConfig = ANECDOTAL_CATEGORIES.reduce<ChartConfig>((acc, c) => {
  acc[c.key] = { label: c.label, color: c.color };
  return acc;
}, {});

const ANECDOTAL_STUDENTS: AnecdotalStudent[] = [
  {
    lrn: "109876543210",
    section: "Mabini - 7A",
    year: "Grade 7",
    dateAdded: "Aug 18, 2026",
    adviser: "Ms. Reyes",
  },
  {
    lrn: "109876543211",
    section: "Rizal - 8B",
    year: "Grade 8",
    dateAdded: "Aug 19, 2026",
    adviser: "Mr. Cruz",
  },
  {
    lrn: "109876543212",
    section: "Bonifacio - 9A",
    year: "Grade 9",
    dateAdded: "Aug 20, 2026",
    adviser: "Ms. Santos",
  },
  {
    lrn: "109876543213",
    section: "Luna - 10C",
    year: "Grade 10",
    dateAdded: "Aug 21, 2026",
    adviser: "Mr. Dela Torre",
  },
  {
    lrn: "109876543214",
    section: "Aguinaldo - 11B",
    year: "Grade 11",
    dateAdded: "Aug 22, 2026",
    adviser: "Ms. Garcia",
  },
];

type TabId = "anecdotal" | "attendance" | "adm" | "sf10";

const TABS: {
  id: TabId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  value: number;
  hint: string;
}[] = [
  {
    id: "anecdotal",
    label: "Anecdotal Records",
    icon: NotebookPen,
    href: "/principal/risk",
    value: 312,
    hint: "By category and recently logged learners",
  },
  {
    id: "attendance",
    label: "Attendances",
    icon: CalendarOff,
    href: "/principal/risk",
    value: 47,
    hint: "Students below 80% present",
  },
  {
    id: "adm",
    label: "ADM",
    icon: FileSignature,
    href: "/principal/adm",
    value: 18,
    hint: "Active learner profiles",
  },
  {
    id: "sf10",
    label: "SF10",
    icon: FileBarChart,
    href: "/principal/reports",
    value: 1240,
    hint: "Cumulative learner forms",
  },
];

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
  const [activeTab, setActiveTab] = React.useState<TabId>("anecdotal");

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

        {/* Card 2 — macOS browser window with tabs */}
        <article className={styles.browserCard}>
          <div className={styles.browserTitleBar}>
            <span className={styles.trafficLights} aria-hidden="true">
              <span className={styles.lightRed} />
              <span className={styles.lightYellow} />
              <span className={styles.lightGreen} />
            </span>
            <div className={styles.tabBar} role="tablist">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    className={`${styles.tab} ${active ? styles.tabActive : ""}`}
                    onClick={() => setActiveTab(tab.id)}
                  >
                    <Icon className={styles.tabIcon} aria-hidden />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          {TABS.map((tab) => (
            <div
              key={tab.id}
              role="tabpanel"
              hidden={activeTab !== tab.id}
              className={styles.browserBody}
            >
              {tab.id === "anecdotal" ? (
                <AnecdotalPanel href={tab.href} label={tab.label} />
              ) : (
                <>
                  <div className={styles.tabStatRow}>
                    <span className={styles.tabStatIcon}>
                      <tab.icon size={20} />
                    </span>
                    <span className={styles.tabStatValue}>
                      {tab.value.toLocaleString()}
                    </span>
                  </div>
                  <p className={styles.tabHint}>{tab.hint}</p>
                  <a className={styles.tabLink} href={tab.href}>
                    Open {tab.label}
                    <ArrowRight className={styles.tabLinkIcon} aria-hidden />
                  </a>
                </>
              )}
            </div>
          ))}
        </article>
      </div>
    </section>
  );
}

function AnecdotalPanel({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  return (
    <div className={styles.anecdotalPanel}>
      <div className={styles.anecdotalTop}>
        <div className={styles.anecdotalChart}>
          <ChartContainer
            id="anecdotal-categories"
            config={categoryConfig}
            className={styles.donutWrap}
          >
            <RechartsPieChart>
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent nameKey="label" hideLabel />}
              />
              <Pie
                data={ANECDOTAL_CATEGORIES}
                dataKey="value"
                nameKey="key"
                innerRadius={26}
                outerRadius={42}
                paddingAngle={2}
              >
                {ANECDOTAL_CATEGORIES.map((entry) => (
                  <Cell key={entry.key} fill={entry.color} />
                ))}
              </Pie>
            </RechartsPieChart>
          </ChartContainer>
        </div>

        <ul className={styles.donutLegend}>
          {ANECDOTAL_CATEGORIES.map((c) => (
            <li key={c.key} className={styles.legendItem}>
              <span
                className={styles.legendDot}
                style={{ backgroundColor: c.color }}
                aria-hidden
              />
              <span className={styles.legendLabel}>{c.label}</span>
              <span className={styles.legendValue}>{c.value}</span>
            </li>
          ))}
        </ul>

        <div className={styles.anecdotalSummary}>
          <div className={styles.summaryItem}>
            <span className={styles.summaryValue}>
              {ANECDOTAL_CATEGORIES.reduce((s, c) => s + c.value, 0)}
            </span>
            <span className={styles.summaryLabel}>Total Records</span>
          </div>
          <div className={styles.summaryItem}>
            <span className={styles.summaryValue}>
              {[...ANECDOTAL_CATEGORIES].sort((a, b) => b.value - a.value)[0].label}
            </span>
            <span className={styles.summaryLabel}>Top Category</span>
          </div>
          <div className={styles.summaryItem}>
            <span className={styles.summaryValue}>
              {Math.round(
                ((ANECDOTAL_CATEGORIES.find((c) => c.key === "behavioral")?.value ??
                  0) +
                  (ANECDOTAL_CATEGORIES.find((c) => c.key === "bullying")?.value ??
                    0)) /
                  ANECDOTAL_CATEGORIES.reduce((s, c) => s + c.value, 0) *
                  100
              )}
              %
            </span>
            <span className={styles.summaryLabel}>
              Behavioral + Bullying
            </span>
          </div>
        </div>
      </div>

      <div className={styles.anecdotalTableCard}>
        <h3 className={styles.tableTitle}>Recently Logged Learners</h3>
        <div className={styles.tableScroll}>
          <table className={styles.anecdotalTable}>
            <thead>
              <tr>
                <th>LRN</th>
                <th>Section</th>
                <th>Year</th>
                <th>Added</th>
                <th>Adviser</th>
              </tr>
            </thead>
            <tbody>
              {ANECDOTAL_STUDENTS.map((s) => (
                <tr key={s.lrn}>
                  <td className={styles.mono}>{s.lrn}</td>
                  <td>{s.section}</td>
                  <td>{s.year}</td>
                  <td>{s.dateAdded}</td>
                  <td>{s.adviser}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <a className={styles.tabLink} href={href}>
        Open {label}
        <ArrowRight className={styles.tabLinkIcon} aria-hidden />
      </a>
    </div>
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
