"use client";

import * as React from "react";
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { usePrimaryScale } from "@/components/risk-dashboard/use-primary-scale";
import { useCoordinatorProfileSettings } from "@/services/settings/profile-settings";
import styles from "./coordinator-referrals-rail.module.css";

interface CoordinatorReferralsRailProps {
  stageCounts: Record<string, number>;
  totalReferred: number;
  isLoading: boolean;
}

const SNAPSHOT_STAGES = [
  { key: "consultation", label: "Consultation" },
  { key: "meeting_parents", label: "Parent meeting" },
  { key: "home_visitation", label: "Home visit" },
  { key: "certification", label: "Certification" },
  { key: "principal_approval", label: "Principal approval" },
];

const WORKFLOW_STEPS = [
  { title: "Forward received", hint: "Nurse / Guidance endorses the case" },
  { title: "Create learner profile", hint: "Accept the referral into a profile" },
  { title: "Book parent meeting", hint: "Schedule with parents / guardians" },
  { title: "Record outcome", hint: "Log attendance, minutes & logbook" },
  { title: "Certify & forward", hint: "Recommend, then endorse to Principal" },
];

const TOOLTIP_STYLE: React.CSSProperties = {
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--card)",
  color: "var(--foreground)",
  fontSize: 12,
};

function RailCard({
  title,
  desc,
  children,
}: {
  title: string;
  desc: string;
  children: React.ReactNode;
}) {
  return (
    <Card className={styles.card} size="sm">
      <span className={styles.glowClip} aria-hidden="true">
        <span className={styles.cardGlow} />
      </span>
      <CardHeader>
        <CardTitle className={styles.sectionTitle}>{title}</CardTitle>
        <CardDescription className={styles.sectionDesc}>{desc}</CardDescription>
      </CardHeader>
      <CardContent className={styles.cardBody}>{children}</CardContent>
    </Card>
  );
}

export function CoordinatorReferralsRail({
  stageCounts,
  totalReferred,
  isLoading,
}: CoordinatorReferralsRailProps) {
  // Donut slices wear the coordinator's own saved palette hex —
  // deterministic (no probe timing): darkest (pure primary) first,
  // stepping toward the card surface. Concrete rgb fills because SVG
  // attributes can't resolve CSS vars. Falls back to the runtime probe
  // only when no saved palette exists yet.
  const { data: profile } = useCoordinatorProfileSettings();
  const scale = usePrimaryScale(
    SNAPSHOT_STAGES.length,
    profile?.primaryColor ?? null,
  );
  const rows = SNAPSHOT_STAGES.map((s, i) => ({
    ...s,
    color: scale[i % scale.length],
    count: isLoading ? 0 : (stageCounts[s.key] ?? 0),
  }));

  return (
    <div className={styles.rail} aria-label="Queue insights">
      <RailCard title="Queue snapshot" desc="Every referred case by pipeline stage.">
        <div className={styles.snapSplit}>
          <ul className={styles.snapLegend}>
            {rows.map((r) => (
              <li key={r.key} className={styles.snapLegendItem}>
                <span className={styles.snapLegendLabel}>
                  <span
                    className={styles.snapLegendDot}
                    style={{ backgroundColor: r.color }}
                    aria-hidden
                  />
                  {r.label}
                </span>
                <span className={styles.snapLegendCount}>
                  {isLoading ? "…" : r.count}
                </span>
              </li>
            ))}
          </ul>
          <div className={styles.snapDonutWrap}>
            <ResponsiveContainer width="100%" height={120}>
              <PieChart>
                <Pie
                  data={rows}
                  dataKey="count"
                  nameKey="label"
                  cx="50%"
                  cy="50%"
                  innerRadius={34}
                  outerRadius={50}
                  paddingAngle={2}
                  strokeWidth={0}
                >
                  {rows.map((r) => (
                    <Cell key={r.key} fill={r.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} />
              </PieChart>
            </ResponsiveContainer>
            <div className={styles.snapDonutCenter}>
              <span className={styles.snapDonutValue}>
                {isLoading ? "…" : totalReferred}
              </span>
              <span className={styles.snapDonutCaption}>referred</span>
            </div>
          </div>
        </div>
        {isLoading ? (
          <p className={styles.snapTotal}>Counting cases…</p>
        ) : null}
      </RailCard>

      <RailCard title="Intake workflow" desc="How a forward becomes a certified case.">
        <ol className={styles.steps}>
          {WORKFLOW_STEPS.map((s, i) => (
            <li key={s.title} className={styles.step}>
              <span className={styles.stepNum} aria-hidden="true">{i + 1}</span>
              <span className={styles.stepBody}>
                <span className={styles.stepTitle}>{s.title}</span>
                <span className={styles.stepHint}>{s.hint}</span>
              </span>
            </li>
          ))}
        </ol>
      </RailCard>
    </div>
  );
}
