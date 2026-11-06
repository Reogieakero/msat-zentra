"use client";

import { ArrowLeftRight, Check, FileText, FolderOpen } from "lucide-react";
import { FolderCard, type FolderFile } from "@/components/ui/FolderCard";
import { Pill } from "@/components/ui/pill";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { StudentMascot } from "@/components/student-mascot/StudentMascot";
import {
  eligibilityLabel,
  eligibilityTone,
} from "@/lib/labels/status-tone";
import {
  canReturn,
  isAwaitingSignature,
  stageLabel,
  type AdmCase,
} from "../../../adm";
import type { AdmReferralRow } from "@/services/principal/adm.types";
import styles from "../all.module.css";

/** Folder colour follows the approval state — amber while the case waits for
 *  the Principal's signature, green once it is final. */
export const ADM_FOLDER_COLORS = {
  awaiting: "#f59e0b",
  returned: "#ef4444",
  signed: "#22c55e",
} as const;

/** Stable slip tone per form type so the same document keeps the same shade
 *  in every card's folder (falls back to the slip's index). */
const FORM_TYPE_TONES: Record<string, 1 | 2 | 3 | 4 | 5> = {
  ANECDOTAL_REPORT: 1,
  REFERRAL_FORM: 2,
  CERTIFICATION: 3,
  MINUTES_OF_MEETING: 4,
  HV_FORM: 5,
};

export function asAdmCase(r: AdmReferralRow): AdmCase {
  return {
    id: r.id,
    student: r.student,
    lrn: r.lrn,
    grade: r.grade,
    section: r.section ?? "",
    stage: r.stage,
    eligibilityStatus: r.eligibilityStatus,
    meetingAttended: false,
    modulesSubmitted: 0,
    modulesTotal: 0,
    deviceIssued: false,
    preparedBy: r.preparedBy,
    datePrepared: r.datePrepared,
    approvedBy: r.approvedBy,
    approvalDate: r.approvalDate,
    forms: r.forms,
  };
}

export function isRowAwaitingSignature(r: AdmReferralRow): boolean {
  return isAwaitingSignature(asAdmCase(r));
}

function formFiles(row: AdmReferralRow): FolderFile[] {
  const forms = row.forms ?? [];
  if (forms.length === 0) {
    return [{ name: "No forms", tag: "empty", tone: 1, icon: "doc" }];
  }
  return forms.map((f, i) => ({
    name: f.title,
    tag: f.status,
    tone: FORM_TYPE_TONES[f.formType] ?? (((i % 5) + 1) as 1 | 2 | 3 | 4 | 5),
    icon: "doc" as const,
  }));
}

/**
 * One endorsed ADM case as an anecdotal-style folder card: stage heading,
 * student identity pills, status pills, the linked-forms folder, and the
 * 24px action buttons that run through the shared dock.
 */
export function AdmReferralKanbanCard({
  row,
  actionId,
  onRequestSign,
  onRequestReturn,
  onViewForms,
}: {
  row: AdmReferralRow;
  actionId: string | null;
  onRequestSign: (id: string) => void;
  onRequestReturn: (id: string) => void;
  onViewForms: (row: AdmReferralRow) => void;
}) {
  const awaiting = isRowAwaitingSignature(row);
  const signed = row.approvedBy !== null;
  const returned = row.returnedAt !== null;
  const formCount = row.forms?.length ?? 0;
  const folderColor = signed
    ? ADM_FOLDER_COLORS.signed
    : returned
      ? ADM_FOLDER_COLORS.returned
      : ADM_FOLDER_COLORS.awaiting;
  const busy = actionId === row.id;
  const locked = actionId !== null;

  return (
    <article className={styles.card} aria-label={`${row.student} ADM case`}>
      <span className={styles.cardHead}>
        <span className={styles.cardTitle}>
          <FileText size={14} aria-hidden style={{ color: folderColor }} />
          <span className="truncate">{stageLabel(row.stage)}</span>
        </span>
        {signed ? (
          <Pill tone="green" label="Principal approval">
            Signed
          </Pill>
        ) : returned ? (
          <Pill tone="red" label="Approval state">
            Returned
          </Pill>
        ) : (
          <Pill tone="amber" label="Approval state">
            Awaiting
          </Pill>
        )}
      </span>

      <div className={styles.cardBody}>
        <div className={styles.studentRow}>
          <StudentMascot name={row.student} seed={row.lrn} size={28} />
          <div className="flex min-w-0 flex-col items-start gap-1">
            <Pill
              tone="amber"
              label="Student"
              className="min-w-0 max-w-full overflow-hidden"
            >
              <span className="truncate">{row.student}</span>
            </Pill>
            <span className="flex min-w-0 max-w-full flex-wrap items-center gap-1">
              <Pill label="LRN" className="tabular-nums">
                {row.lrn}
              </Pill>
              {row.section ? (
                <Pill tone="amber" label="Section">
                  {row.section}
                </Pill>
              ) : null}
              <Pill label="Grade">{row.grade}</Pill>
            </span>
          </div>
        </div>

        <span className={styles.statusRow}>
          <Pill
            tone={eligibilityTone(row.eligibilityStatus)}
            label="Eligibility"
          >
            {eligibilityLabel(row.eligibilityStatus)}
          </Pill>
          <Pill tone="neutral" label="Linked forms">
            {formCount} form{formCount === 1 ? "" : "s"}
          </Pill>
          <Pill tone="neutral" label="Prepared by">
            {row.preparedBy}
          </Pill>
        </span>

        <span className={styles.folderWrap}>
          <span className="flex w-full max-w-[220px] justify-center">
            <FolderCard
              label=""
              folderColor={folderColor}
              files={formFiles(row)}
              onCardClick={() => onViewForms(row)}
              cardAriaLabel={`Open ${formCount} linked form${formCount === 1 ? "" : "s"} for ${row.student}`}
            />
          </span>
        </span>

        <p className={styles.metaRow}>
          <span>Prepared {row.datePrepared}</span>
          {row.approvalDate ? <span>Signed {row.approvalDate}</span> : null}
        </p>

        {returned ? (
          <p className={styles.returnNote} title={row.returnReason ?? undefined}>
            <span>Returned {row.returnedAt}</span>
            {row.returnReason ? <> · {row.returnReason}</> : null}
          </p>
        ) : null}

        <div className={styles.actionRow}>
          {awaiting ? (
            <Button
              variant="outline"
              size="sm"
              className="h-6 px-2 text-[11px] [&_svg]:size-3"
              aria-label={`Sign and approve case for ${row.student}`}
              title="Sign & approve"
              disabled={locked}
              aria-busy={busy || undefined}
              onClick={() => onRequestSign(row.id)}
            >
              {busy ? <Spinner aria-hidden /> : <Check aria-hidden />}
              Sign
            </Button>
          ) : null}
          {canReturn(asAdmCase(row)) && !returned ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-[11px] [&_svg]:size-3"
              aria-label={`Return case for ${row.student} for revision`}
              title="Return for revision"
              disabled={locked}
              aria-busy={busy || undefined}
              onClick={() => onRequestReturn(row.id)}
            >
              <ArrowLeftRight aria-hidden />
              Return
            </Button>
          ) : null}
          {formCount > 0 ? (
            <Button
              variant="outline"
              size="sm"
              className="ml-auto h-6 px-2 text-[11px] [&_svg]:size-3"
              aria-label={`View ${formCount} linked form${formCount === 1 ? "" : "s"} for ${row.student}`}
              title={`${formCount} linked form${formCount === 1 ? "" : "s"}`}
              onClick={() => onViewForms(row)}
            >
              <FolderOpen aria-hidden />
              Forms ({formCount})
            </Button>
          ) : (
            <span className={`${styles.noForms} ml-auto`}>No forms</span>
          )}
        </div>
      </div>
    </article>
  );
}
