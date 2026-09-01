import * as React from "react";
import { X, ShieldAlert, CalendarClock } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import type { RiskFactors, RiskSnapshotStudent, GradeMode } from "../types";
import styles from "../interventions.module.css";

const FACTOR_CLASS: Record<keyof RiskFactors, string> = {
  academic: styles.factorAcademic,
  attendance: styles.factorAttendance,
  behavioral: styles.factorBehavioral,
};

const APPROVAL_LABEL: Record<string, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  modified: "Modified",
};

const OUTCOME_LABEL: Record<string, string> = {
  ongoing: "Ongoing",
  resolved: "Resolved",
  unresolved: "Unresolved",
};

function titleCase(v: string): string {
  return v.charAt(0).toUpperCase() + v.slice(1);
}

function initials(name: string): string {
  return name
    .replace(/[^a-zA-Z ]/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() ?? "")
    .join("");
}

function FactorTag({ on, label }: { on: boolean; label: keyof RiskFactors }) {
  return (
    <span
      className={`${styles.factorTag} ${on ? styles.factorTagOn : ""} ${on ? FACTOR_CLASS[label] : ""}`}
    >
      {on ? <span className={styles.factorDot} aria-hidden /> : null}
      {titleCase(label)}
    </span>
  );
}

function fieldValue(v: string | null): string {
  return v && v.length > 0 ? v : "—";
}

function formatDate(v: string | null): string {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function KpiRow({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.kpiRow}>
      <span className={styles.kpiKey}>{label}</span>
      <span className={styles.kpiVal}>{value}</span>
    </div>
  );
}

export function InterventionDrawer({
  student,
  gradeMode,
  onClose,
}: {
  student: RiskSnapshotStudent | null;
  gradeMode: GradeMode;
  onClose: () => void;
}) {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  React.useEffect(() => {
    if (!student) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [student, onClose]);

  if (!mounted) return null;

  const iv = student?.intervention;

  const riskTone =
    student?.riskLevel === "High"
      ? styles.riskHigh
      : student?.riskLevel === "Moderate"
        ? styles.riskModerate
        : styles.riskLow;

  return (
    <Sheet open={student !== null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" showCloseButton={false} className={styles.sheet}>
        {student && (
          <>
            <div className={styles.drawerHead}>
              <div className={styles.identity}>
                <div className={styles.avatar}>{initials(student.studentName)}</div>
                <div className={styles.identityText}>
                  <SheetTitle className={styles.drawerTitle}>
                    {student.studentName}
                  </SheetTitle>
                  <SheetDescription className={styles.drawerSub}>
                    LRN {student.lrn}
                  </SheetDescription>
                </div>
              </div>
              <button
                type="button"
                className={styles.drawerClose}
                onClick={onClose}
                aria-label="Close drawer"
              >
                <X size={16} aria-hidden />
              </button>
            </div>

            <div className={styles.metaStrip}>
              <div className={styles.metaChip}>
                <span className={styles.metaChipLabel}>Section</span>
                <span className={styles.metaChipValue}>{student.section}</span>
              </div>
              <div className={styles.metaChip}>
                <span className={styles.metaChipLabel}>Grade</span>
                <span className={styles.metaChipValue}>{student.gradeLevel}</span>
              </div>
              {student.snapshotDate ? (
                <div className={styles.metaChip}>
                  <span className={styles.metaChipLabel}>Snapshot</span>
                  <span className={styles.metaChipValue}>
                    {formatDate(student.snapshotDate)}
                  </span>
                </div>
              ) : null}
            </div>

            <div className={styles.statGrid}>
              <div className={`${styles.riskBadge} ${riskTone}`}>
                <span className={styles.riskBadgeLabel}>Risk level</span>
                <span className={styles.riskBadgeValue}>{student.riskLevel}</span>
              </div>
            </div>

            <section className={styles.section}>
              <div className={styles.sectionHead}>
                <ShieldAlert size={14} className={styles.sectionIcon} aria-hidden />
                <h3 className={styles.sectionTitle}>Risk breakdown</h3>
              </div>

              <div className={styles.factorRow}>
                <FactorTag on={student.factors.academic} label="academic" />
                <FactorTag on={student.factors.attendance} label="attendance" />
                <FactorTag on={student.factors.behavioral} label="behavioral" />
              </div>

              {student.factors.academic ? (
                <div className={styles.gradeList}>
                  <div className={styles.gradeHead}>
                    <span>Subject</span>
                    <span>{gradeMode === "raw" ? "Raw" : "Transmuted"}</span>
                  </div>
                  {student.subjectGrades.length === 0 ? (
                    <p className={styles.noteInBox}>
                      No final grades recorded for this term.
                    </p>
                  ) : (
                    student.subjectGrades.map((g) => (
                      <div key={g.code} className={styles.gradeItem}>
                        <span className={styles.gradeName}>{g.subject}</span>
                        <span
                          className={`${styles.gradeVal} ${g.belowThreshold ? styles.gradeLow : ""}`}
                        >
                          {gradeMode === "raw"
                            ? g.computedAverage ?? "—"
                            : g.transmutedGrade ?? "—"}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              ) : null}

              {!student.factors.academic && (
                <p className={styles.noteInBox}>
                  No academic risk flagged — attend to behavioral or attendance factors
                  below.
                </p>
              )}
            </section>

            <section className={styles.section}>
              <div className={styles.sectionHead}>
                <CalendarClock size={14} className={styles.sectionIcon} aria-hidden />
                <h3 className={styles.sectionTitle}>Intervention plan</h3>
                {iv ? (
                  <span
                    className={`${styles.statusPill} ${iv.outcomeStatus === "resolved" ? styles.statusResolved : iv.outcomeStatus === "unresolved" ? styles.statusUnresolved : styles.statusOngoing}`}
                  >
                    {OUTCOME_LABEL[iv.outcomeStatus] ?? titleCase(iv.outcomeStatus)}
                  </span>
                ) : null}
              </div>

              {!iv ? (
                <div className={styles.card}>
                  <p className={styles.cardTitle}>No open intervention</p>
                  <p className={styles.note}>
                    This student is flagged at-risk but has not yet been picked up by
                    the Guidance Counselor.
                  </p>
                </div>
              ) : (
                <div className={styles.card}>
                  <KpiRow label="Recommended action" value={iv.recommendedAction} />
                  <KpiRow
                    label="Assigned to"
                    value={fieldValue(iv.assignedStaffName ?? iv.assignedTo)}
                  />
                  <KpiRow label="Approval status" value={APPROVAL_LABEL[iv.approvalStatus] ?? titleCase(iv.approvalStatus)} />
                  <KpiRow label="Started" value={formatDate(iv.createdAt)} />
                </div>
              )}
            </section>

            <p className={styles.footerNote}>
              Interventions are auto-assigned to the Guidance Counselor. The Principal
              has read-only visibility for tracking progress.
            </p>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
