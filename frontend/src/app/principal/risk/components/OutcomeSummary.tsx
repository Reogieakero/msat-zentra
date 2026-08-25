import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { RiskBoardData } from "../riskBoard";
import styles from "./outcome-summary.module.css";

const OUTCOME_META = [
  { key: "ongoing", label: "Ongoing", color: "#d97706" },
  { key: "resolved", label: "Resolved", color: "#15803d" },
  { key: "unresolved", label: "Unresolved", color: "#b91c1c" },
] as const;

type OutcomeKey = keyof RiskBoardData["interventionOutcome"];

const FACTORS: { key: keyof RiskBoardData["factorTotals"]; label: string }[] = [
  { key: "Academic", label: "Academic" },
  { key: "Attendance", label: "Attendance" },
  { key: "Behavioral", label: "Behavioral" },
];

export function OutcomeSummary({
  outcome,
  factorTotals,
  loading = false,
}: {
  outcome: RiskBoardData["interventionOutcome"] | null;
  factorTotals: RiskBoardData["factorTotals"] | null;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <Card className={styles.card}>
        <CardHeader className={styles.header}>
          <CardTitle>Intervention Outcome</CardTitle>
          <span className={styles.subtitle}>status-only</span>
        </CardHeader>
        <CardContent className={styles.content}>
          <ul className={styles.list}>
            {OUTCOME_META.map((o) => (
              <li key={o.key} className={styles.item}>
                <div className={styles.itemTop}>
                  <Skeleton className={styles.skelDot} />
                  <Skeleton className={styles.skelLabel} />
                  <Skeleton className={styles.skelValue} />
                </div>
                <Skeleton className={styles.skelBar} />
              </li>
            ))}
          </ul>
          <div className={styles.factorBlock}>
            <Skeleton className={styles.skelFactorTitle} />
            <ul className={styles.factorList}>
              {FACTORS.map((f) => (
                <li key={f.key}>
                  <Skeleton className={styles.skelFactorLabel} />
                  <Skeleton className={styles.skelFactorValue} />
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>
    );
  }

  const safeOutcome = outcome ?? { ongoing: 0, resolved: 0, unresolved: 0 };
  const safeFactors = factorTotals ?? { Academic: 0, Attendance: 0, Behavioral: 0 };

  const total =
    safeOutcome.ongoing + safeOutcome.resolved + safeOutcome.unresolved;

  const [fill, setFill] = React.useState(false);
  React.useEffect(() => {
    let frame = 0;
    setFill(false);
    frame = requestAnimationFrame(() => setFill(true));
    const interval = setInterval(() => {
      setFill((prev) => !prev);
    }, 3000);
    return () => {
      cancelAnimationFrame(frame);
      clearInterval(interval);
    };
  }, []);

  return (
    <Card className={styles.card}>
      <CardHeader className={styles.header}>
        <CardTitle>Intervention Outcome</CardTitle>
        <span className={styles.subtitle}>status-only</span>
      </CardHeader>
      <CardContent className={styles.content}>
        <ul className={styles.list}>
          {OUTCOME_META.map((o) => {
            const value = safeOutcome[o.key as OutcomeKey];
            const pct = total > 0 ? Math.round((value / total) * 100) : 0;
            return (
              <li key={o.key} className={styles.item}>
                <div className={styles.itemTop}>
                  <span className={styles.dot} style={{ background: o.color }} />
                  <span className={styles.label}>{o.label}</span>
                  <span className={styles.value}>{value}</span>
                </div>
                 <div className={styles.bar}>
                   <span
                     className={styles.barFill}
                     style={{
                       width: `${fill ? pct : 0}%`,
                       background: o.color,
                     }}
                   />
                 </div>
              </li>
            );
          })}
        </ul>

        <div className={styles.factorBlock}>
          <p className={styles.factorTitle}>Flagged by factor</p>
          <ul className={styles.factorList}>
            {FACTORS.map((f) => (
              <li key={f.key}>
                <span>{f.label}</span>
                <span className={styles.factorValue}>{safeFactors[f.key]}</span>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
