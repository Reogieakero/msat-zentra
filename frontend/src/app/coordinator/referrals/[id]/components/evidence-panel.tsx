"use client";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FolderCard } from "@/components/ui/FolderCard";
import { anecdotalCategoryColor } from "@/lib/labels/anecdotal";
import {
  friendlyWords,
} from "@/services/coordinator/labels";
import type {
  AdmFormRef,
  CoordinatorCaseDetail,
} from "@/services/coordinator/coordinator.types";
import type { CaseStepId } from "../case-steps";
import { FORM_DOT, FORM_LABELS } from "../../components/coordinator-referrals-constants";
import styles from "../case-page.module.css";
export function EvidencePanel({
  d,
  activeTab,
  referral,
  anecdotal,
  anecdotalLocked,
  gcLoading,
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
    return (
      <>
        {anecdotal ? (
          <div className={styles.folderCenter}>
            <button
              type="button"
              className={styles.folderBtn}
              onClick={() =>
                anecdotalLocked
                  ? onOpenEndorsedNotice()
                  : onOpenAnecdotal(anecdotal.id)
              }
              aria-label={
                anecdotalLocked
                  ? `Anecdotal report for ${d.student} is locked awaiting the Principal's signature`
                  : `Open ${d.student}'s anecdotal report file (GCForm-01)`
              }
            >
              <FolderCard
                label="GCForm-01"
                sublabel={`${anecdotal.observationDate}, ${anecdotal.section}`}
                folderColor={anecdotalCategoryColor(anecdotal.category)}
                files={[
                  {
                    name: `OCForm-01_${anecdotal.observationDate}`,
                    tag: friendlyWords(anecdotal.category),
                    icon: "doc" as const,
                  },
                ]}
              />
            </button>
          </div>
        ) : (
          <p className={styles.muted}>No anecdotal write-up on file.</p>
        )}
      </>
    );
  }
  if (activeTab === "referral") {
    return (
      <>
        {referral && anecdotal ? (
          <div className={styles.folderCenter}>
            <button
              type="button"
              className={styles.folderBtn}
              onClick={() => onOpenGcForm()}
              disabled={gcLoading}
              aria-label={`Open the GCForm-03 referral form file for ${d.student}`}
            >
              <FolderCard
                label="GCForm-03"
                sublabel={`${d.student}, ${anecdotal.observationDate}`}
                folderColor={anecdotalCategoryColor(anecdotal.category)}
                files={[
                  {
                    name: `GCForm-03_${anecdotal.observationDate}`,
                    tag: friendlyWords(anecdotal.category),
                    icon: "doc" as const,
                  },
                ]}
              />
            </button>
            {gcLoading ? (
              <Loader2
                className="animate-spin"
                aria-hidden
                style={{ width: "0.875rem", height: "0.875rem" }}
              />
            ) : null}
          </div>
        ) : (
          <p className={styles.muted}>No referral form on file.</p>
        )}
      </>
    );
  }
  if (activeTab === "evidence") {
    return (
      <div className={styles.card}>
        <span className={styles.glowClip} aria-hidden="true">
          <span className={styles.cardGlow} />
        </span>
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
          <ul className={styles.evidenceList}>
            {d.forms.map((f) => (
              <li key={f.id} className={styles.evidenceItem}>
                <span
                  className={styles.evidenceDot}
                  style={{
                    backgroundColor: FORM_DOT[f.status] ?? "#d4d4d4",
                  }}
                  aria-hidden
                />
                <span>{FORM_LABELS[f.formType] ?? friendlyWords(f.formType)}</span>
                <Badge variant="outline">{friendlyWords(f.status)}</Badge>
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  className={styles.logBtn}
                  style={{ marginLeft: "auto" }}
                  onClick={() => onSeeDetails(f)}
                  aria-label={`See details for ${FORM_LABELS[f.formType] ?? friendlyWords(f.formType)}`}
                >
                  See details
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }
  return null;
}
