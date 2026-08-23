import * as React from "react";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Button } from "@/components/ui/button";
import { PieChart as RechartsPieChart, Pie, Cell } from "recharts";
import { TabLink } from "./TabLink";
import { ADM_DOCUMENTS, ADM_DONUT_COLORS, GRADE_ORDER } from "./data";
import styles from "./adm-panel.module.css";

export function AdmPanel({
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

      <TabLink href={href} label={label} />
    </div>
  );
}
