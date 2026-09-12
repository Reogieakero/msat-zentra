"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { GuidanceAlertItem } from "./guidance-alerts-data";
import {
  GuidanceAlertsFilters,
  type FactorFilter,
  type LevelFilter,
} from "./guidance-alerts-filters";
import styles from "./guidance-alerts-grid.module.css";

// "pending" -> "Pending", "in_progress" -> "In progress".
function formatStatus(value: string): string {
  const words = value.replace(/_/g, " ").toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

const FACTOR_LABELS = [
  { key: "academic", label: "Academic" },
  { key: "attendance", label: "Attendance" },
  { key: "behavioral", label: "Behavioral" },
] as const;

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.detailRow}>
      <span className={styles.detailLabel}>{label}</span>
      <span className={styles.detailValue}>{value}</span>
    </div>
  );
}

interface GuidanceAlertsGridProps {
  alerts: GuidanceAlertItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  query: string;
  onQueryChange: (value: string) => void;
  level: LevelFilter;
  onLevelChange: (value: LevelFilter) => void;
  factor: FactorFilter;
  onFactorChange: (value: FactorFilter) => void;
}

export function GuidanceAlertsGrid({
  alerts,
  page,
  pageSize,
  total,
  totalPages,
  onPageChange,
  query,
  onQueryChange,
  level,
  onLevelChange,
  factor,
  onFactorChange,
}: GuidanceAlertsGridProps) {
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <Card className={styles.panel}>
      <CardHeader className={styles.header}>
        <div className={styles.headerText}>
          <CardTitle className={styles.sectionTitle}>Flag queue</CardTitle>
          <CardDescription className={styles.sectionDesc}>
            Live flags, High first — {total} student{total === 1 ? "" : "s"} this term.
          </CardDescription>
        </div>
        <CardAction className={styles.headerActions}>
          <GuidanceAlertsFilters
            query={query}
            onQueryChange={onQueryChange}
            level={level}
            onLevelChange={onLevelChange}
            factor={factor}
            onFactorChange={onFactorChange}
          />
        </CardAction>
      </CardHeader>
      <CardContent>
        {alerts.length === 0 ? (
          <p className={styles.empty}>No flagged students match the current filters.</p>
        ) : (
          <div className={styles.grid}>
            {alerts.map((row) => (
              <article key={row.id} className={styles.alertCard}>
                <div className={styles.cardHead}>
                  <div>
                    <p className={styles.student}>{row.student}</p>
                    <p className={styles.sub}>
                      <span className={styles.mono}>{row.lrn}</span> · {row.section} ·{" "}
                      {row.grade}
                    </p>
                  </div>
                  <div className={styles.headBadges}>
                    <Badge variant={row.level === "High" ? "default" : "warning"}>
                      {row.level}
                    </Badge>
                    {row.track === "adm" ? (
                      <Badge variant="secondary">ADM</Badge>
                    ) : (
                      <Badge variant="outline">General</Badge>
                    )}
                  </div>
                </div>
                <ul className={styles.chips}>
                  {FACTOR_LABELS.filter((f) => row.factors[f.key]).map((f) => (
                    <li key={f.key}>
                      <Badge variant="outline">{f.label}</Badge>
                    </li>
                  ))}
                </ul>
                <ul className={styles.triggerList}>
                  {row.triggers.map((trigger) => (
                    <li key={trigger} className={styles.triggerItem}>
                      {trigger}
                    </li>
                  ))}
                </ul>
                <div className={styles.details}>
                  {row.track === "adm" && row.admStageLabel && (
                    <DetailRow label="ADM stage" value={row.admStageLabel} />
                  )}
                  <DetailRow
                    label="Referral"
                    value={
                      row.referralStatus
                        ? formatStatus(row.referralStatus)
                        : "Not referred"
                    }
                  />
                  <DetailRow
                    label="Intervention"
                    value={
                      row.interventionOutcome
                        ? formatStatus(row.interventionOutcome)
                        : "—"
                    }
                  />
                </div>
                <div className={styles.actions}>
                  <Button asChild size="xs" variant="outline">
                    <Link href="/guidance/referrals">Referrals</Link>
                  </Button>
                  <Button asChild size="xs" variant="outline">
                    <Link href="/guidance/interventions">Interventions</Link>
                  </Button>
                </div>
              </article>
            ))}
          </div>
        )}
        <div className={styles.pager}>
          <p className={styles.range}>
            Showing {start}–{end} of {total}
          </p>
          <div className={styles.pagerButtons}>
            <Button
              size="xs"
              variant="outline"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
            >
              Previous
            </Button>
            <span className={styles.pageLabel}>
              Page {page} of {totalPages}
            </span>
            <Button
              size="xs"
              variant="outline"
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
