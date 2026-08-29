import * as React from "react";
import { X } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import type { RiskFactors, RiskSnapshotStudent } from "../types";
import styles from "../interventions.module.css";

const FACTOR_CHIP: Record<keyof RiskFactors, string> = {
  academic: "#b91c1c",
  attendance: "#2563eb",
  behavioral: "#7c3aed",
};

function titleCase(v: string): string {
  return v.charAt(0).toUpperCase() + v.slice(1);
}

function FactorTag({ on, label }: { on: boolean; label: keyof RiskFactors }) {
  return (
    <span
      className={`${styles.factorTag} ${on ? styles.factorTagOn : ""}`}
      style={on ? { color: FACTOR_CHIP[label], borderColor: FACTOR_CHIP[label] } : undefined}
    >
      {titleCase(label)}
    </span>
  );
}

export function InterventionDrawer({
  student,
  onClose,
}: {
  student: RiskSnapshotStudent | null;
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

  return (
    <Sheet
      open={student !== null}
      onOpenChange={(o) => !o && onClose()}
    >
      <SheetContent side="right" showCloseButton={false} className={styles.sheet}>
        {student && (
          <>
            <SheetHeader className={styles.drawerHead}>
              <div>
                <SheetTitle className={styles.drawerTitle}>
                  {student.studentName}
                </SheetTitle>
                <SheetDescription className={styles.drawerSub}>
                  LRN {student.lrn} · {student.section}
                </SheetDescription>
              </div>
              <button
                type="button"
                className={styles.drawerClose}
                onClick={onClose}
                aria-label="Close drawer"
              >
                <X size={16} aria-hidden />
              </button>
            </SheetHeader>

            <div className={styles.metaRow}>
              <span>Risk: {student.riskLevel}</span>
              <span>Flags: {student.riskCount}</span>
              <span>{student.gradeLevel}</span>
            </div>

            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>Risk breakdown</h3>
              <div className={styles.factorRow}>
                <FactorTag on={student.factors.academic} label="academic" />
                <FactorTag on={student.factors.attendance} label="attendance" />
                <FactorTag on={student.factors.behavioral} label="behavioral" />
              </div>
              {student.factors.academic ? (
                <div className={styles.gradeList}>
                  <div className={styles.gradeHead}>
                    <span>Subject</span>
                    <span>Raw</span>
                    <span>Transmuted</span>
                  </div>
                  {student.subjectGrades.length === 0 ? (
                    <p className={styles.note}>No final grades recorded for this term.</p>
                  ) : (
                    student.subjectGrades.map((g) => (
                      <div key={g.code} className={styles.gradeItem}>
                        <span className={styles.gradeName}>{g.subject}</span>
                        <span
                          className={`${styles.gradeVal} ${g.belowThreshold ? styles.gradeLow : ""}`}
                        >
                          {g.computedAverage ?? "—"}
                        </span>
                        <span
                          className={`${styles.gradeVal} ${g.belowThreshold ? styles.gradeLow : ""}`}
                        >
                          {g.transmutedGrade ?? "—"}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              ) : null}
            </section>

            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>Intervention</h3>
              {!iv ? (
                <p className={styles.note}>
                  No open intervention. This student is flagged at-risk but has not yet
                  been picked up by the Guidance Counselor.
                </p>
              ) : (
                <>
                  <div className={styles.fieldRow}>
                    <span className={styles.fieldKey}>Outcome</span>
                    <span className={styles.fieldVal}>{titleCase(iv.outcomeStatus)}</span>
                  </div>
                  <p className={styles.sectionNote}>{iv.recommendedAction}</p>
                  <p className={styles.note}>
                    Interventions are auto-assigned to the Guidance Counselor. The
                    Principal has read-only visibility for tracking progress.
                  </p>
                </>
              )}
            </section>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
