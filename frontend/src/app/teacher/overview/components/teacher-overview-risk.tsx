"use client";
import { ShieldAlert } from "lucide-react";
import { RadialBar, RadialBarChart } from "recharts";
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";
import styles from "./teacher-overview-header.module.css";
const RISK_COLORS = ["#f59e0b", "#22c55e", "#3b82f6"];
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
  const data = hideBehavioral ? all.slice(0, 2) : all;
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
