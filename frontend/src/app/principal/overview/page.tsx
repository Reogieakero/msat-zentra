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
import { Button } from "@/components/ui/button";
import {
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
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

type AttendancePoint = {
  day: string;
  present: number;
};

const ATTENDANCE_TREND: AttendancePoint[] = [
  { day: "Aug 18", present: 1204 },
  { day: "Aug 19", present: 1187 },
  { day: "Aug 20", present: 1211 },
  { day: "Aug 21", present: 1198 },
  { day: "Aug 23", present: 1226 },
];

const attendanceConfig = {
  present: { label: "Present", color: "#166534" },
} satisfies ChartConfig;

type GradeAttendance = {
  grade: string;
  present: number;
  total: number;
};

const GRADE_ATTENDANCE: GradeAttendance[] = [
  { grade: "Grade 7", present: 214, total: 220 },
  { grade: "Grade 8", present: 198, total: 205 },
  { grade: "Grade 9", present: 205, total: 212 },
  { grade: "Grade 10", present: 189, total: 196 },
  { grade: "Grade 11", present: 210, total: 218 },
  { grade: "Grade 12", present: 210, total: 233 },
];

type AdmDocument = {
  id: string;
  lrn: string;
  student: string;
  grade: string;
  preparedBy: string;
  datePrepared: string;
  status: "pending_signature" | "signed";
  eligibility: string;
};

const ADM_DOCUMENTS: AdmDocument[] = [
  {
    id: "ADM-2041",
    lrn: "109876543220",
    student: "A. Mendoza",
    grade: "Grade 7",
    preparedBy: "Mr. Cruz",
    datePrepared: "Aug 19, 2026",
    status: "pending_signature",
    eligibility: "Eligible",
  },
  {
    id: "ADM-2042",
    lrn: "109876543221",
    student: "J. Fernando",
    grade: "Grade 8",
    preparedBy: "Ms. Reyes",
    datePrepared: "Aug 20, 2026",
    status: "pending_signature",
    eligibility: "Eligible",
  },
  {
    id: "ADM-2043",
    lrn: "109876543222",
    student: "K. Villanueva",
    grade: "Grade 9",
    preparedBy: "Ms. Santos",
    datePrepared: "Aug 21, 2026",
    status: "pending_signature",
    eligibility: "For Review",
  },
  {
    id: "ADM-2039",
    lrn: "109876543218",
    student: "R. Aquino",
    grade: "Grade 10",
    preparedBy: "Mr. Dela Torre",
    datePrepared: "Aug 17, 2026",
    status: "signed",
    eligibility: "Eligible",
  },
];

const ADM_DONUT_COLORS = [
  "#166534",
  "#1d4ed8",
  "#b91c1c",
  "#c2410c",
  "#7c3aed",
  "#0e7490",
];

type Sf10Status = "missing" | "available" | "attached";

type Sf10Level = {
  grade: string;
  attached: number;
  available: number;
  missing: number;
};

const SF10_LEVELS: Sf10Level[] = [
  { grade: "Grade 7", attached: 2, available: 1, missing: 1 },
  { grade: "Grade 8", attached: 1, available: 2, missing: 0 },
  { grade: "Grade 9", attached: 2, available: 0, missing: 1 },
  { grade: "Grade 10", attached: 1, available: 1, missing: 1 },
  { grade: "Grade 11", attached: 2, available: 1, missing: 0 },
  { grade: "Grade 12", attached: 1, available: 0, missing: 1 },
];

const SF10_STATUS_META: Record<
  Sf10Status,
  { label: string; color: string }
> = {
  missing: { label: "Missing", color: "#b91c1c" },
  available: { label: "Available", color: "#c2410c" },
  attached: { label: "Attached", color: "#166534" },
};

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
              ) : tab.id === "attendance" ? (
                <AttendancePanel href={tab.href} label={tab.label} />
              ) : tab.id === "adm" ? (
                <AdmPanel href={tab.href} label={tab.label} />
              ) : tab.id === "sf10" ? (
                <Sf10Panel href={tab.href} label={tab.label} />
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
                  <Button asChild variant="outline" size="sm" className={styles.tabLink}>
                    <a href={tab.href}>
                      Open {tab.label}
                      <ArrowRight aria-hidden />
                    </a>
                  </Button>
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

      <Button asChild variant="outline" size="sm" className={styles.tabLink}>
        <a href={href}>
          Open {label}
          <ArrowRight aria-hidden />
        </a>
      </Button>
    </div>
  );
}

function AttendancePanel({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  return (
    <div className={styles.attendancePanel}>
      <div className={styles.attendanceChartCard}>
        <h3 className={styles.chartTitle}>Present Count · Last 5 School Days</h3>
        <ChartContainer
          id="attendance-trend"
          config={attendanceConfig}
          className={styles.lineWrap}
        >
          <RechartsLineChart
            data={ATTENDANCE_TREND}
            margin={{ top: 8, right: 8, bottom: 0, left: -16 }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="day"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              fontSize={12}
            />
            <YAxis tickLine={false} axisLine={false} fontSize={12} width={40} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Line
              dataKey="present"
              type="monotone"
              stroke="var(--color-present)"
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
          </RechartsLineChart>
        </ChartContainer>
      </div>

      <div className={styles.gradeGrid}>
        {GRADE_ATTENDANCE.map((g) => {
          const rate = Math.round((g.present / g.total) * 100);
          return (
            <div key={g.grade} className={styles.gradeCard}>
              <div className={styles.gradeHead}>
                <span className={styles.gradeName}>{g.grade}</span>
                <span className={styles.gradeRate}>{rate}%</span>
              </div>
              <div className={styles.gradeMetric}>
                <span className={styles.gradePresent}>{g.present}</span>
                <span className={styles.gradeTotal}>/ {g.total} present</span>
              </div>
              <div className={styles.gradeBar}>
                <span
                  className={styles.gradeBarFill}
                  style={{ width: `${rate}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <Button asChild variant="outline" size="sm" className={styles.tabLink}>
        <a href={href}>
          Open {label}
          <ArrowRight aria-hidden />
        </a>
      </Button>
    </div>
  );
}

function AdmPanel({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  const pendingDocs = ADM_DOCUMENTS.filter(
    (d) => d.status === "pending_signature"
  );
  const signed = ADM_DOCUMENTS.length - pendingDocs.length;

  const GRADE_ORDER = [
    "Grade 7",
    "Grade 8",
    "Grade 9",
    "Grade 10",
    "Grade 11",
    "Grade 12",
  ];
  const admDonutData = GRADE_ORDER.map((grade, i) => ({
    grade,
    value: pendingDocs.filter((d) => d.grade === grade).length,
    color: ADM_DONUT_COLORS[i],
  })).filter((d) => d.value > 0);

  const admDonutConfig = admDonutData.reduce<ChartConfig>((acc, d) => {
    acc[d.grade] = { label: d.grade, color: d.color };
    return acc;
  }, {});

  return (
    <div className={styles.admPanel}>
      <div className={styles.admTop}>
        <div className={styles.admSummary}>
          <div className={styles.admSummaryItem}>
            <span className={styles.admSummaryValue}>{pendingDocs.length}</span>
            <span className={styles.admSummaryLabel}>Pending Cases</span>
          </div>
          <div className={styles.admSummaryItem}>
            <span className={styles.admSummaryValue}>{signed}</span>
            <span className={styles.admSummaryLabel}>Signed This Term</span>
          </div>
        </div>

        <span className={styles.admDonut}>
          <ChartContainer
            id="adm-donut"
            config={admDonutConfig}
            className={styles.admDonutWrap}
          >
            <RechartsPieChart>
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent nameKey="grade" hideLabel />}
              />
              <Pie
                data={admDonutData}
                dataKey="value"
                nameKey="grade"
                innerRadius={20}
                outerRadius={34}
                stroke="none"
                isAnimationActive={false}
                paddingAngle={2}
              >
                {admDonutData.map((d) => (
                  <Cell key={d.grade} fill={d.color} />
                ))}
              </Pie>
            </RechartsPieChart>
          </ChartContainer>
        </span>

        <ul className={styles.admDonutLegend}>
          {admDonutData.map((d) => (
            <li key={d.grade} className={styles.admLegendItem}>
              <span
                className={styles.admLegendDot}
                style={{ backgroundColor: d.color }}
                aria-hidden
              />
              <span className={styles.admLegendLabel}>{d.grade}</span>
              <span className={styles.admLegendValue}>{d.value}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className={styles.admList}>
        {pendingDocs.map((d) => (
          <div key={d.id} className={styles.admDoc}>
            <div className={styles.admDocMain}>
              <div className={styles.admDocTop}>
                <span className={styles.admDocId}>{d.id}</span>
                <span className={styles.admStatus}>Pending Approval</span>
              </div>
              <div className={styles.admDocMeta}>
                <span className={styles.mono}>{d.lrn}</span>
                <span>{d.student}</span>
                <span>{d.grade}</span>
                <span className={styles.admMuted}>
                  Prepared by {d.preparedBy} · {d.datePrepared}
                </span>
              </div>
              <span className={styles.admEligibility}>
                Eligibility: {d.eligibility}
              </span>
            </div>
            <Button size="sm" className={styles.admSign}>
              Approve
            </Button>
          </div>
        ))}
      </div>

      <Button asChild variant="outline" size="sm" className={styles.tabLink}>
        <a href={href}>
          Open {label}
          <ArrowRight aria-hidden />
        </a>
      </Button>
    </div>
  );
}

function Sf10Panel({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  const GRADE_ORDER = [
    "Grade 7",
    "Grade 8",
    "Grade 9",
    "Grade 10",
    "Grade 11",
    "Grade 12",
  ];

  const counts = {
    missing: SF10_LEVELS.reduce((s, l) => s + l.missing, 0),
    available: SF10_LEVELS.reduce((s, l) => s + l.available, 0),
    attached: SF10_LEVELS.reduce((s, l) => s + l.attached, 0),
  };
  const sf10DonutData = (
    ["attached", "available", "missing"] as Sf10Status[]
  ).map((s) => ({
    status: s,
    value: counts[s],
    color: SF10_STATUS_META[s].color,
  }));

  const sf10DonutConfig = sf10DonutData.reduce<ChartConfig>((acc, d) => {
    acc[d.status] = { label: SF10_STATUS_META[d.status].label, color: d.color };
    return acc;
  }, {});

  return (
    <div className={styles.sf10Panel}>
      <div className={styles.admTop}>
        <div className={styles.sf10DonutGroup}>
          <span className={styles.admDonut}>
            <ChartContainer
              id="sf10-donut"
              config={sf10DonutConfig}
              className={styles.admDonutWrap}
            >
              <RechartsPieChart>
                <ChartTooltip
                  cursor={false}
                  content={<ChartTooltipContent nameKey="status" hideLabel />}
                />
                <Pie
                  data={sf10DonutData}
                  dataKey="value"
                  nameKey="status"
                  innerRadius={20}
                  outerRadius={34}
                  stroke="none"
                  isAnimationActive={false}
                  paddingAngle={2}
                >
                  {sf10DonutData.map((d) => (
                    <Cell key={d.status} fill={d.color} />
                  ))}
                </Pie>
              </RechartsPieChart>
            </ChartContainer>
          </span>

          <ul className={styles.sf10DonutLegend}>
            {sf10DonutData.map((d) => (
              <li key={d.status} className={styles.sf10SummaryItem}>
                <span
                  className={styles.sf10SummaryDot}
                  style={{ backgroundColor: d.color }}
                  aria-hidden
                />
                <span className={styles.sf10SummaryValue}>{d.value}</span>
                <span className={styles.sf10SummaryLabel}>
                  {SF10_STATUS_META[d.status].label}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className={styles.sf10SummaryTotal}>
          <span className={styles.sf10SummaryValue}>
            {counts.attached + counts.available + counts.missing}
          </span>
          <span className={styles.sf10SummaryLabel}>Total Records</span>
        </div>
      </div>

      <div className={styles.sf10Grid}>
        {GRADE_ORDER.map((grade) => {
          const level = SF10_LEVELS.find((l) => l.grade === grade);
          if (!level) return null;
          return (
            <div key={grade} className={styles.sf10Grade}>
              <span className={styles.sf10GradeName}>{grade}</span>
              <div className={styles.sf10Levels}>
                {(["attached", "available", "missing"] as Sf10Status[]).map(
                  (s) => (
                    <div
                      key={s}
                      className={styles.sf10LevelStat}
                      style={{ borderColor: SF10_STATUS_META[s].color }}
                    >
                      <span
                        className={styles.sf10LevelValue}
                        style={{ color: SF10_STATUS_META[s].color }}
                      >
                        {level[s]}
                      </span>
                      <span className={styles.sf10LevelLabel}>
                        {SF10_STATUS_META[s].label}
                      </span>
                    </div>
                  )
                )}
              </div>
            </div>
          );
        })}
      </div>

      <Button asChild variant="outline" size="sm" className={styles.tabLink}>
        <a href={href}>
          Open {label}
          <ArrowRight aria-hidden />
        </a>
      </Button>
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
