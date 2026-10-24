"use client";
import { Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { AnecdotalRecordKanbanCard } from "@/components/anecdotal/anecdotal-record-kanban-card";
import {
  friendlyWords,
} from "@/services/coordinator/labels";
import type {
  AdmFormRef,
  CoordinatorCaseDetail,
} from "@/services/coordinator/coordinator.types";
import type { CaseStepId } from "../case-steps";
import { FORM_LABELS } from "../../components/coordinator-referrals-constants";
import styles from "../case-page.module.css";
export function EvidencePanel({
  d,
  activeTab,
  referral,
  anecdotal,
  anecdotalLocked,
  hasAttendedMeeting,
  onOpenGcForm,
  onOpenAnecdotal,
  onOpenEndorsedNotice,
  onSeeDetails,
}: {
  d: CoordinatorCaseDetail;
  activeTab: CaseStepId;
  referral: CoordinatorCaseDetail["referral"];
  anecdotal: CoordinatorCaseDetail["anecdotal"];
  anecdotalLocked: boolean;
  gcLoading: boolean;
  hasAttendedMeeting: boolean;
  onOpenGcForm: () => void;
  onOpenAnecdotal: (id: string) => void;
  onOpenEndorsedNotice: () => void;
  onSeeDetails: (f: AdmFormRef) => void;
}) {
  if (activeTab === "anecdotal") {
    return anecdotal ? (
      <AnecdotalRecordKanbanCard
        category={anecdotal.category}
        headerTitle="GCForm-01"
        studentName={d.student}
        metaText={d.lrn}
        metaTitle={`${d.lrn} · ${anecdotal.section}`}
        fileName={`OCForm-01_${anecdotal.observationDate}`}
        fileTag={friendlyWords(anecdotal.category)}
        folderAlign="start"
        headerRight={
          anecdotalLocked ? (
            <Badge variant="outline" className="shrink-0 rounded-md">
              Locked
            </Badge>
          ) : undefined
        }
        openLabel={
          anecdotalLocked
            ? `Anecdotal report for ${d.student} is locked awaiting the Principal's signature`
            : `Open ${d.student}'s anecdotal report file (GCForm-01)`
        }
        onOpen={() =>
          anecdotalLocked ? onOpenEndorsedNotice() : onOpenAnecdotal(anecdotal.id)
        }
      />
    ) : (
      <p className={styles.muted}>No anecdotal write-up on file.</p>
    );
  }
  if (activeTab === "referral") {
    return referral && anecdotal ? (
      <AnecdotalRecordKanbanCard
        category={anecdotal.category}
        headerTitle="GCForm-03"
        studentName={d.student}
        metaText={d.lrn}
        metaTitle={`${d.lrn} · ${anecdotal.section}`}
        fileName={`GCForm-03_${anecdotal.observationDate}`}
        fileTag={friendlyWords(anecdotal.category)}
        folderAlign="start"
        categoryColor="#f59e0b"
        folderColor="#f59e0b"
        tone={1}
        openLabel={`Open the GCForm-03 referral form file for ${d.student}`}
        onOpen={() => onOpenGcForm()}
      />
    ) : (
      <p className={styles.muted}>No referral form on file.</p>
    );
  }
  if (activeTab === "evidence") {
    return (
      <div className={styles.panel}>
        <h2 className={styles.cardTitle}>Evidence chain</h2>
        {d.forms.length === 0 ? (
          d.kind === "referral" && hasAttendedMeeting ? (
            <ul className={styles.evidenceList}>
              {[
                { label: "Referral on file", ok: referral !== null },
                { label: "Anecdotal report on file", ok: anecdotal !== null },
                { label: "Parent meeting attended", ok: hasAttendedMeeting },
              ].map((e) => (
                <li key={e.label} className={styles.evidenceItem}>
                  <Badge variant={e.ok ? "success" : "outline"}>
                    {e.ok ? "On file" : "Missing"}
                  </Badge>
                  <span>{e.label}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.headerNote}>
              {d.kind === "referral"
                ? "No learner profile yet — create one to start collecting evidence."
                : "No forms recorded yet."}
            </p>
          )
        ) : (
          <div className={styles.evidenceCard}>
            <ul className={styles.evidenceRow}>
              {d.forms.map((f) => {
                const ok = f.status === "verified";
                const label =
                  FORM_LABELS[f.formType] ?? friendlyWords(f.formType);
                return (
                  <li key={f.id}>
                    <button
                      type="button"
                      className={styles.evidenceCol}
                      onClick={() => onSeeDetails(f)}
                      aria-label={`See details for ${label}`}
                    >
                      <span
                        className={styles.evidenceCheck}
                        data-ok={ok ? "true" : "false"}
                        aria-hidden
                      >
                        {ok ? <Check size={12} strokeWidth={3} /> : ""}
                      </span>
                      <span className={styles.evidenceColLabel}>{label}</span>
                      <span
                        className={`${styles.evidencePill} ${ok ? styles.evidencePillGreen : ""}`}
                      >
                        {friendlyWords(f.status)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    );
  }
  return null;
}
