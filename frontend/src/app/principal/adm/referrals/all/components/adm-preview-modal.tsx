"use client";
import { ArrowUpRight, FileText, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";
import { KanbanOverlay } from "@/components/ui/kanban-overlay";
import { StudentMascot } from "@/components/student-mascot/StudentMascot";
import { formatDate } from "@/lib/labels/datetime";
import { formStatusLabel, formStatusTone } from "@/lib/labels/status-tone";
import type { AdmReferralForm } from "@/services/principal/adm.types";
import styles from "../all.module.css";

const FORM_TYPE_LABELS: Record<string, string> = {
  REFERRAL_FORM: "Referral",
  ANECDOTAL_REPORT: "Anecdotal",
  CERTIFICATION: "Certification",
  MINUTES_OF_MEETING: "Minutes",
  HV_FORM: "Home Visit",
  PRINCIPAL_SIGNAGE: "Principal signage",
};

function fileHref(fileUrl: string): string {
  if (/^(https?:|data:)/i.test(fileUrl)) return fileUrl;
  const base = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").replace(/\/$/, "");
  return `${base}/${fileUrl.replace(/^\//, "")}`;
}
const isImageFile = (url: string) =>
  /^data:image\//i.test(url) || /\.(png|jpe?g|gif|webp|svg)(\?|#|$)/i.test(url);
const isPdfFile = (url: string) => /\.pdf(\?|#|$)/i.test(url);

export interface AdmPreviewState {
  form: AdmReferralForm;
  student: string;
  lrn: string;
  anecdotalRecordId: string | null;
}

export function AdmPreviewModal({
  preview,
  onClose,
  onOpenOfficial,
}: {
  preview: AdmPreviewState | null;
  onClose: () => void;
  onOpenOfficial: (anecdotalRecordId: string) => void;
}) {
  const form = preview?.form;
  const typeLabel = form
    ? (FORM_TYPE_LABELS[form.formType] ?? form.title)
    : "";

  return (
    <KanbanOverlay
      open={preview !== null}
      onClose={onClose}
      title={form?.title ?? "Report"}
      icon={
        preview ? (
          <StudentMascot name={preview.student} seed={preview.lrn} size={24} />
        ) : undefined
      }
      description={
        preview ? (
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-medium text-foreground">
              {preview.student}
            </span>
            <Pill label="LRN" className="tabular-nums">
              {preview.lrn}
            </Pill>
            <Pill
              tone={formStatusTone(preview.form.status)}
              label="Form status"
            >
              {formStatusLabel(preview.form.status)}
            </Pill>
          </span>
        ) : undefined
      }
      width="lg"
      footer={
        preview ? (
          <div className="flex flex-wrap items-center justify-between gap-2 px-1 pb-1 pt-1">
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <Paperclip className="size-3.5" aria-hidden />
              {preview.form.fileUrl ? "Attachment on file" : "No file attached"}
            </span>
            <div className="flex flex-wrap items-center justify-end gap-2">
              {preview.anecdotalRecordId ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    preview.anecdotalRecordId &&
                    onOpenOfficial(preview.anecdotalRecordId)
                  }
                >
                  Open official anecdotal form
                  <ArrowUpRight aria-hidden />
                </Button>
              ) : null}
            </div>
          </div>
        ) : null
      }
    >
      {preview ? (
        <div className={styles.previewBody}>
          <dl className={styles.previewFacts}>
            <div className={styles.previewFact}>
              <dt className={styles.previewLabel}>Document</dt>
              <dd className={styles.previewValue}>{typeLabel}</dd>
            </div>
            <div className={styles.previewFact}>
              <dt className={styles.previewLabel}>Uploaded</dt>
              <dd className={styles.previewValue}>
                {preview.form.uploadedAt
                  ? formatDate(preview.form.uploadedAt.slice(0, 10))
                  : "—"}
              </dd>
            </div>
            <div
              className={`${styles.previewFact} ${styles.previewFactWide}`}
            >
              <dt className={styles.previewLabel}>Notes</dt>
              <dd
                className={`${styles.previewValue} ${
                  preview.form.notes?.trim() ? "" : styles.previewValueMuted
                }`}
              >
                {preview.form.notes?.trim() || "No notes on file."}
              </dd>
            </div>
          </dl>

          <div className={styles.previewSection}>
            <span className={styles.previewLabel}>Preview</span>
            {preview.form.fileUrl ? (
              isImageFile(preview.form.fileUrl) ? (
                <figure className={styles.previewCanvas}>
                  <img
                    src={fileHref(preview.form.fileUrl)}
                    alt={`${preview.form.title} attachment`}
                    className={styles.previewImg}
                  />
                </figure>
              ) : isPdfFile(preview.form.fileUrl) ? (
                <iframe
                  src={fileHref(preview.form.fileUrl)}
                  title={`${preview.form.title} attachment`}
                  className={styles.previewDoc}
                />
              ) : (
                <a
                  href={fileHref(preview.form.fileUrl)}
                  target="_blank"
                  rel="noreferrer"
                  className={styles.previewLink}
                >
                  <FileText className="size-3.5" aria-hidden />
                  Open attached file
                  <ArrowUpRight className="size-3.5" aria-hidden />
                </a>
              )
            ) : (
              <p className={styles.previewEmpty}>
                No file attached to this report.
              </p>
            )}
          </div>
        </div>
      ) : null}
    </KanbanOverlay>
  );
}
