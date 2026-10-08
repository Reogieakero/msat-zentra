"use client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CardModal } from "@/components/ui/CardModal";
import type { AdmReferralForm } from "@/services/principal/adm.types";
import styles from "../all.module.css";
const FORM_TYPE_LABELS: Record<string, string> = {
  REFERRAL_FORM: "Referral",
  ANECDOTAL_REPORT: "Anecdotal",
  CERTIFICATION: "Certification",
  MINUTES_OF_MEETING: "Minutes",
  HV_FORM: "Home Visit",
};
function fileHref(fileUrl: string): string {
  if (/^https?:\/\//i.test(fileUrl)) return fileUrl;
  const base = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").replace(/\/$/, "");
  return `${base}/${fileUrl.replace(/^\//, "")}`;
}
const isImageFile = (url: string) =>
  /\.(png|jpe?g|gif|webp|svg)(\?|#|$)/i.test(url);
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
  return (
    <CardModal
      open={preview !== null}
      onClose={onClose}
      title={preview?.form.title ?? "Report"}
      description={
        preview ? `${preview.student} · ${preview.lrn}` : undefined
      }
      watchKey={preview?.form.id}
    >
      {preview ? (
        <div className={styles.previewBody}>
          <dl className={styles.previewMeta}>
            <div className={styles.previewRow}>
              <dt>Type</dt>
              <dd>
                {FORM_TYPE_LABELS[preview.form.formType] ?? preview.form.title}
              </dd>
            </div>
            <div className={styles.previewRow}>
              <dt>Status</dt>
              <dd>
                <Badge variant="outline">{preview.form.status}</Badge>
              </dd>
            </div>
            <div className={styles.previewRow}>
              <dt>Uploaded</dt>
              <dd>
                {preview.form.uploadedAt
                  ? preview.form.uploadedAt.slice(0, 10)
                  : "—"}
              </dd>
            </div>
            <div className={styles.previewRow}>
              <dt>Notes</dt>
              <dd>
                {preview.form.notes?.trim()
                  ? preview.form.notes
                  : "No notes on file."}
              </dd>
            </div>
          </dl>
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
            </Button>
          ) : null}
          {preview.form.fileUrl ? (
            isImageFile(preview.form.fileUrl) ? (
              <img
                src={fileHref(preview.form.fileUrl)}
                alt={`${preview.form.title} attachment`}
                className={styles.previewImg}
              />
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
                Open attached file
              </a>
            )
          ) : (
            <p className={styles.previewEmpty}>
              No file attached to this report.
            </p>
          )}
        </div>
      ) : null}
    </CardModal>
  );
}
