"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, FileText } from "lucide-react";
import type { FiledDetail, PreviewDetail } from "@/services/anecdotal/anecdotal.types";
import styles from "./AnecdotalChat.module.css";

/** Filed-record card: the persisted filing with preview/download actions. */
export function FiledDetailCard({
  detail,
  downloadingId,
  onPreview,
  onDownload,
}: {
  detail: FiledDetail;
  downloadingId: string | null;
  onPreview: (recordId: string) => void;
  onDownload: (recordId: string) => void;
}) {
  return (
    <div className={styles.detailWrap}>
      <div className={styles.detailCard}>
        <div className={styles.detailHead}>
          <p className={styles.detailTitle}>
            {detail.studentName}
          </p>
          <Badge variant="warning">GCForm-01</Badge>
        </div>
        <p className={styles.detailSub}>
          {detail.lrn} · {detail.category} · {detail.tier} ·{" "}
          {detail.location}
        </p>
        <div className={styles.detailReasonRow}>
          <Badge variant="outline">{detail.category}</Badge>
          <span className={styles.detailFiledOn}>
            Filed: {detail.filedOn}
          </span>
        </div>
        <p className={styles.detailNote}>
          &ldquo;{detail.incident}&rdquo;
        </p>
        <dl className={styles.detailMeta}>
          <div className={styles.detailMetaRow}>
            <dt>Section</dt>
            <dd>{detail.section}</dd>
          </div>
          <div className={styles.detailMetaRow}>
            <dt>Observation time</dt>
            <dd>{detail.observationDateTime}</dd>
          </div>
          <div className={styles.detailMetaRow}>
            <dt>Status</dt>
            <dd>
              {detail.tier === "Confidential"
                ? "Confidential"
                : "Restricted"}
            </dd>
          </div>
          {detail.notes ? (
            <div className={styles.detailMetaRow}>
              <dt>Notes</dt>
              <dd>{detail.notes}</dd>
            </div>
          ) : null}
          {detail.classPerformance ? (
            <div className={styles.detailMetaRow}>
              <dt>Class performance</dt>
              <dd>{detail.classPerformance}</dd>
            </div>
          ) : null}
           {detail.attendanceSummary ? (
             <div className={styles.detailMetaRow}>
               <dt>Attendance</dt>
               <dd>{detail.attendanceSummary}</dd>
             </div>
           ) : null}
        </dl>
        {detail.recordId ? (
          <div className={styles.cardActions}>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onPreview(detail.recordId)}
            >
              <FileText aria-hidden />
              Preview OCForm-01
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={downloadingId === detail.recordId}
              onClick={() => onDownload(detail.recordId)}
            >
              <Download aria-hidden />
              {downloadingId === detail.recordId ? "Preparing…" : ".xlsx"}
            </Button>
          </div>
        ) : null}
      </div>
      <hr className={styles.endMark} aria-hidden />
    </div>
  );
}

/** Pre-filing review card (no record id exists yet). */
export function PreviewDetailCard({ preview }: { preview: PreviewDetail }) {
  return (
    <div className={styles.detailWrap}>
      <div className={styles.previewCard}>
        <div className={styles.detailHead}>
          <p className={styles.detailTitle}>
            {preview.studentName}
          </p>
          <Badge variant="warning">GCForm-01 preview</Badge>
        </div>
        <p className={styles.detailSub}>
          {preview.lrn} · {preview.category} · {preview.tier} ·{" "}
          {preview.location}
        </p>
        <div className={styles.detailReasonRow}>
          <Badge variant="outline">{preview.category}</Badge>
          <span className={styles.detailFiledOn}>
            Obs: {preview.observationDateTime}
          </span>
        </div>
        <p className={styles.detailNote}>
          &ldquo;{preview.incident}&rdquo;
        </p>
        <dl className={styles.detailMeta}>
          <div className={styles.detailMetaRow}>
            <dt>Section</dt>
            <dd>{preview.section}</dd>
          </div>
          <div className={styles.detailMetaRow}>
            <dt>Status</dt>
            <dd>
              {preview.tier === "Confidential"
                ? "Confidential"
                : "Restricted"}
            </dd>
          </div>
          {preview.notes ? (
            <div className={styles.detailMetaRow}>
              <dt>Notes / Recommendations</dt>
              <dd>{preview.notes}</dd>
            </div>
          ) : null}
          {preview.classPerformance ? (
            <div className={styles.detailMetaRow}>
              <dt>Class performance</dt>
              <dd>{preview.classPerformance}</dd>
            </div>
          ) : null}
          {preview.attendanceSummary ? (
            <div className={styles.detailMetaRow}>
              <dt>Attendance</dt>
              <dd>{preview.attendanceSummary}</dd>
            </div>
          ) : null}
        </dl>
      </div>
      <hr className={styles.endMark} aria-hidden />
    </div>
  );
}
