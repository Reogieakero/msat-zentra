"use client";

import { Inbox, School } from "lucide-react";
import {
  GuidanceDonutPanel,
  GuidanceSectionsLinePanel,
} from "./guidance-overview-panels";
import type {
  GuidanceReferralTypeRow,
  GuidanceSectionHeatRow,
} from "@/services/guidance/overview.types";
import styles from "./guidance-overview.module.css";

interface GuidanceOverviewCaseloadChartsProps {
  referralsByType: GuidanceReferralTypeRow[];
  sectionHeat: GuidanceSectionHeatRow[];
}

/**
 * Caseload section — a wide stacked-bar board for sections needing attention
 * plus the referred-cases donut, in the same 2-up grid as the nurse trends
 * boards. Top 6 sections by risk, amber palette.
 */
export function GuidanceOverviewCaseloadCharts({
  referralsByType,
  sectionHeat,
}: GuidanceOverviewCaseloadChartsProps) {
  const typeRows = referralsByType.map((r) => ({
    key: r.type,
    label: r.type,
    count: r.count,
  }));

  const sectionRows = [...sectionHeat]
    .sort((a, b) => b.high + b.moderate - (a.high + a.moderate))
    .slice(0, 6)
    .map((r) => ({
      key: `${r.grade}-${r.section}`,
      label: r.section,
      high: r.high,
      moderate: r.moderate,
    }));

  const referralsTotal = typeRows.reduce((n, r) => n + r.count, 0);
  const admCount = typeRows.find((r) => r.key === "ADM")?.count ?? 0;
  const counselingCount =
    typeRows.find((r) => r.key === "Counseling")?.count ?? 0;
  const referralsText =
    referralsTotal === 0
      ? "No cases referred to you for the active term yet."
      : `${referralsTotal} referred cases this term — ${admCount} ADM and ${counselingCount} counseling.`;

  const topSection = sectionRows[0];
  const sectionsTotal = sectionRows.reduce(
    (n, r) => n + r.high + r.moderate,
    0,
  );
  const sectionsText =
    !topSection || sectionsTotal === 0
      ? "No section has at-risk students right now."
      : `${topSection.label} leads with ${topSection.high} high-risk and ${topSection.moderate} moderate-risk students.`;

  return (
    <div className={styles.twoCol}>
      <GuidanceSectionsLinePanel
        title="Sections needing attention"
        description="High-risk students per section · top 6 sections."
        rows={sectionRows}
        emptyTitle="No sections need attention"
        emptyText="No section has at-risk students right now."
        icon={School}
        interpretation={sectionsText}
      />
      <GuidanceDonutPanel
        title="Referred cases by type"
        description="ADM vs counseling split of the cases on your desk this term."
        rows={typeRows}
        unit="records"
        emptyTitle="No referred cases"
        emptyText="No cases referred to you for the active term yet."
        icon={Inbox}
        sortDescending={false}
        interpretation={referralsText}
      />
    </div>
  );
}
