import * as React from "react";
import { X } from "lucide-react";
import type {
  InterventionLink,
  OutcomeStatus,
  RiskSnapshotStudent,
  StaffOption,
} from "../types";
import { createIntervention, updateIntervention } from "../api";
import styles from "../interventions.module.css";

function titleCase(v: string): string {
  return v.charAt(0).toUpperCase() + v.slice(1);
}

function FactorTag({ on, label }: { on: boolean; label: string }) {
  return (
    <span className={`${styles.factorTag} ${on ? styles.factorTagOn : ""}`}>
      {label}
    </span>
  );
}

const OUTCOME_OPTS: OutcomeStatus[] = ["ongoing", "resolved", "unresolved"];

export function InterventionDrawer({
  student,
  staff,
  onClose,
  onSaved,
}: {
  student: RiskSnapshotStudent | null;
  staff: StaffOption[];
  onClose: () => void;
  onSaved: (studentId: string, link: InterventionLink | null) => void;
}) {
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  // Form state for creating a new intervention.
  const [action, setAction] = React.useState("");
  const [assignee, setAssignee] = React.useState("");

  // Reset transient form/error when a different student is opened.
  React.useEffect(() => {
    setErr(null);
    setBusy(false);
    setAction("");
    setAssignee("");
  }, [student?.studentId]);

  if (!student) return null;

  const iv = student.intervention;
  const isPending = iv?.approvalStatus === "pending";
  const isApproved = iv?.approvalStatus === "approved";

  const run = async (fn: () => Promise<InterventionLink | null>) => {
    setBusy(true);
    setErr(null);
    try {
      const result = await fn();
      onSaved(student.studentId, result);
    } catch (e: unknown) {
      const status = (e as { response?: { status?: number } })?.response?.status;
      setErr(
        status === 403
          ? "Outcome can only be set for approved interventions."
          : "Action failed. Please try again."
      );
    } finally {
      setBusy(false);
    }
  };

  const doCreate = () =>
    run(async () => {
      if (!action.trim() || !assignee) {
        setErr("Recommend an action and assign a staff member.");
        return null;
      }
      return createIntervention({
        studentId: student.studentId,
        recommendedAction: action,
        assignedTo: assignee,
        riskLevelAtFlag: student.riskLevel,
      });
    });

  return (
    <>
      <div className={styles.overlay} onClick={onClose} aria-hidden />
      <aside className={styles.drawer} aria-label="Intervention detail" role="dialog">
        <div className={styles.drawerHead}>
          <div>
            <h2 className={styles.drawerTitle}>{student.studentName}</h2>
            <p className={styles.drawerSub}>
              LRN {student.lrn} · {student.section}
            </p>
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

        <div className={styles.metaRow}>
          <span>Risk: {student.riskLevel}</span>
          <span>Flags: {student.riskCount}</span>
          <span>{student.gradeLevel}</span>
        </div>

        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Risk breakdown</h3>
          <div className={styles.factorRow}>
            <FactorTag on={student.factors.academic} label="Academic" />
            <FactorTag on={student.factors.attendance} label="Attendance" />
            <FactorTag on={student.factors.behavioral} label="Behavioral" />
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

        {!iv ? (
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Create intervention</h3>
            <div className={styles.form}>
              <div className={styles.formField}>
                <label className={styles.formLabel} htmlFor="iv-action">
                  Recommended action
                </label>
                <textarea
                  id="iv-action"
                  className={styles.textarea}
                  value={action}
                  onChange={(e) => setAction(e.target.value)}
                  placeholder="Describe the recommended intervention…"
                />
              </div>
              <div className={styles.formField}>
                <label className={styles.formLabel} htmlFor="iv-staff">
                  Assign to staff
                </label>
                <select
                  id="iv-staff"
                  className={styles.select}
                  value={assignee}
                  onChange={(e) => setAssignee(e.target.value)}
                >
                  <option value="">Select staff…</option>
                  {staff.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.fullName} · {titleCase(s.role.replace(/_/g, " "))}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                className={styles.assignBtn}
                disabled={busy}
                onClick={doCreate}
              >
                {busy ? "Creating…" : "Create & assign"}
              </button>
              {err ? <p className={styles.note}>{err}</p> : null}
            </div>
          </section>
        ) : (
          <>
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>Intervention</h3>
              <div className={styles.fieldRow}>
                <span className={styles.fieldKey}>Assigned to</span>
                <span className={styles.fieldVal}>
                  {iv.assignedStaffName ?? "Unassigned"}
                </span>
              </div>
              <div className={styles.fieldRow}>
                <span className={styles.fieldKey}>Approval</span>
                <span className={styles.fieldVal}>{titleCase(iv.approvalStatus)}</span>
              </div>
              <div className={styles.fieldRow}>
                <span className={styles.fieldKey}>Outcome</span>
                <span className={styles.fieldVal}>{titleCase(iv.outcomeStatus)}</span>
              </div>
              <p className={styles.sectionNote}>{iv.recommendedAction}</p>
            </section>

            <section className={styles.section}>
              <div className={styles.actions}>
                {isPending ? (
                  <>
                    <span className={styles.actionsLabel}>Principal decision</span>
                    <div className={styles.btnRow}>
                      <button
                        type="button"
                        className={`${styles.btn} ${styles.btnApprove}`}
                        disabled={busy}
                        onClick={() => run(() => updateIntervention(iv.id, { approvalStatus: "approved" }))}
                      >
                        {busy ? "Working…" : "Approve"}
                      </button>
                      <button
                        type="button"
                        className={`${styles.btn} ${styles.btnReject}`}
                        disabled={busy}
                        onClick={() => run(() => updateIntervention(iv.id, { approvalStatus: "rejected" }))}
                      >
                        {busy ? "Working…" : "Reject"}
                      </button>
                    </div>
                  </>
                ) : null}

                <span className={styles.actionsLabel}>Outcome</span>
                <div className={styles.segmented} role="group" aria-label="Outcome status">
                  {OUTCOME_OPTS.map((o) => (
                    <button
                      key={o}
                      type="button"
                      className={`${styles.segment} ${iv.outcomeStatus === o ? styles.segmentOn : ""}`}
                      disabled={busy || !isApproved}
                      aria-pressed={iv.outcomeStatus === o}
                      onClick={() => run(() => updateIntervention(iv.id, { outcomeStatus: o }))}
                    >
                      {titleCase(o)}
                    </button>
                  ))}
                </div>
                {!isApproved ? (
                  <p className={styles.note}>
                    Outcome can be set only after the intervention is approved.
                  </p>
                ) : null}
                {err ? <p className={styles.note}>{err}</p> : null}
              </div>
            </section>
          </>
        )}
      </aside>
    </>
  );
}
