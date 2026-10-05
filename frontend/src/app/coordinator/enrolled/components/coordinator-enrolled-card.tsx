"use client";

import { CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  deriveAdmCaseStatus,
  eligibilityLabel,
  formatManilaDateLong,
  stageLabel,
  type AdmCaseRow,
} from "../../components/coordinator-data";
import type { HistoryTarget } from "../../components/CaseHistoryDialog";
import { historyTargetFor } from "../../components/CaseHistoryDialog";
import styles from "./coordinator-enrolled-card.module.css";

interface CoordinatorEnrolledCardProps {
  row: AdmCaseRow;
  onHistory: (target: HistoryTarget) => void;
}

/* Enrolled learner card — view-only info card. Mirrors the coordinator
   left-rail live reminder card (aurora visual header with status pill +
   full-width CTA), with a bold title and primary-colored detail labels.
   All accents ride --primary so the coordinator's saved palette repaints
   every card. */
export function CoordinatorEnrolledCard({
  row,
  onHistory,
}: CoordinatorEnrolledCardProps) {
  const caseStatus = deriveAdmCaseStatus(
    row.stage,
    row.eligibilityStatus,
    row.approvedBy,
    row.referralStatus,
  );

  // Module pass-tracking — the backend serves submitted/released counts per
  // profile row. Undefined (stale cache) renders an honest syncing state
  // instead of a misleading 0.
  const hasModuleData =
    typeof row.modulesSubmitted === "number" &&
    typeof row.modulesTotal === "number";
  const submitted = row.modulesSubmitted ?? 0;
  const total = row.modulesTotal ?? 0;
  const percent =
    hasModuleData && total > 0
      ? Math.min(100, Math.round((submitted / total) * 100))
      : 0;

  const moduleText = !hasModuleData
    ? "Module progress syncing…"
    : total === 0
      ? "No modules released yet"
      : submitted >= total
        ? `All ${total} module${total === 1 ? "" : "s"} submitted`
        : `${submitted} of ${total} modules submitted`;

  const approvedText = `${row.approvedBy ?? "the Principal"}${row.approvalDate ? ` · ${formatManilaDateLong(row.approvalDate)}` : ""}`;

  const isMonitoring = row.stage === "enrollment_monitoring";

  return (
    <div className={styles.card}>
      <div className={styles.visual} title={stageLabel(row.stage)}>
        <span className={styles.visualInner}>
          {isMonitoring ? (
            <span className={styles.liveDot} aria-hidden="true" />
          ) : (
            <CheckCircle2
              className={styles.visualIcon}
              aria-hidden="true"
              size={12}
              strokeWidth={2}
            />
          )}
          <span>{caseStatus.label}</span>
        </span>
      </div>

      <div className={styles.body}>
        <p className={styles.title}>{row.student}</p>
        <dl className={styles.infoRows}>
          <div className={styles.infoRow}>
            <dt className={styles.infoTerm}>LRN</dt>
            <dd className={styles.infoValue} title={row.lrn}>
              {row.lrn}
            </dd>
          </div>
          <div className={styles.infoRow}>
            <dt className={styles.infoTerm}>Grade</dt>
            <dd className={styles.infoValue}>{row.grade || "—"}</dd>
          </div>
          <div className={styles.infoRow}>
            <dt className={styles.infoTerm}>Eligibility</dt>
            <dd className={styles.infoValue}>
              <Badge
                variant={
                  row.eligibilityStatus === "eligible"
                    ? "secondary"
                    : row.eligibilityStatus === "ineligible"
                      ? "destructive"
                      : "outline"
                }
              >
                {eligibilityLabel(row.eligibilityStatus)}
              </Badge>
            </dd>
          </div>
        </dl>
        <div
          className={styles.track}
          role="progressbar"
          aria-label={`Modules submitted for ${row.student}`}
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={submitted}
          aria-valuetext={moduleText}
        >
          <div className={styles.fill} style={{ width: `${percent}%` }} />
        </div>
        <p className={styles.note}>{moduleText}</p>
        <p className={styles.note}>Approved by {approvedText}</p>
      </div>

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.cta}
          onClick={() => onHistory(historyTargetFor(row))}
          aria-label={`Track case for ${row.student}`}
        >
          Track case
        </button>
      </div>
    </div>
  );
}
