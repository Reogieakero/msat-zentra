"use client";

import * as React from "react";
import { CalendarClock, Clock, Flag, Hash, Image as ImageIcon, Send, Tag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { type DocEntry, entryStatusLabel, entryStatusVariant, fileHref, formatBytes } from "./documentaries-utils";
import { formatDate } from "../../referrals/components/nurse-referrals-format";
import styles from "./NurseDocumentariesList.module.css";

export interface DocumentaryDetailsProps {
  entry: DocEntry;
  onOpenViewer: (entry: DocEntry, index: number) => void;
}

export function DocumentaryDetails({ entry, onOpenViewer }: DocumentaryDetailsProps) {
  return (
    <>
      <DialogHeader>
        <p className={styles.eyebrow}>
          {entry.isEndorse
            ? "ADM consultation · ready to endorse"
            : entry.row.type === "ADM"
              ? "ADM consultation"
              : "Clinic session"}
        </p>
        <DialogTitle>{entry.row.student}</DialogTitle>
        <DialogDescription asChild>
          <p className={styles.metaRow}>
            <span className={styles.lrn}>{entry.row.lrn}</span>
            <span aria-hidden="true"> · </span>
            <span>{entry.row.grade} · {entry.row.section}</span>
          </p>
        </DialogDescription>
      </DialogHeader>

      <div className={styles.fieldList}>
        <div className={styles.fieldRow}>
          <span className={styles.fieldLabel}>
            <Hash size={13} aria-hidden /> Case No.
          </span>
          <span className={styles.fieldValue}>{entry.row.id}</span>
        </div>
        <div className={styles.fieldRow}>
          <span className={styles.fieldLabel}>
            <Clock size={13} aria-hidden /> Time referred
          </span>
          <span className={styles.fieldValue}>{formatDate(entry.row.date)}</span>
        </div>
        <div className={styles.fieldRow}>
          <span className={styles.fieldLabel}>
            <Send size={13} aria-hidden /> Referred
          </span>
          <span className={styles.fieldValue}>
            {entry.isEndorse
              ? "Endorse ADM"
              : entry.row.type === "ADM"
                ? "Teacher / ADM referral"
                : "Clinic referral"}
          </span>
        </div>
        <div className={styles.fieldRow}>
          <span className={styles.fieldLabel}>
            <Tag size={13} aria-hidden /> Category
          </span>
          <span className={styles.fieldValue}>{entry.row.category}</span>
        </div>
        <div className={styles.fieldRow}>
          <span className={styles.fieldLabel}>
            <Flag size={13} aria-hidden /> Status
          </span>
          <span className={styles.fieldValue}>
            <Badge variant={entryStatusVariant(entry)}>
              {entryStatusLabel(entry)}
            </Badge>
          </span>
        </div>
        {entry.row.followUpDate && (
          <div className={styles.fieldRow}>
            <span className={styles.fieldLabel}>
              <CalendarClock size={13} aria-hidden /> Follow-up due
            </span>
            <span className={styles.fieldValue}>
              {formatDate(entry.row.followUpDate)}
            </span>
          </div>
        )}
      </div>

      {entry.details !== "" && entry.details !== "—" && (
        <div className={styles.fieldList}>
          <h4 className={styles.fieldSection}>Session notes</h4>
          <p className={styles.notes}>{entry.details}</p>
        </div>
      )}
      {entry.outcome !== "" && (
        <div className={styles.fieldList}>
          <h4 className={styles.fieldSection}>Outcome</h4>
          <p className={styles.outcome}>{entry.outcome}</p>
        </div>
      )}
      {entry.files.length > 0 && (
        <div className={styles.files}>
          <p className={styles.filesLabel}>
            Files ({entry.files.length})
          </p>
          <ul className={styles.fileGrid} aria-label="Attached files">
            {entry.files.map((f, i) => {
              const size = formatBytes(f.fileSize);
              return (
                <li key={f.id}>
                  <button
                    type="button"
                    className={styles.thumbBtn}
                    onClick={() => onOpenViewer(entry, i)}
                    title={size ? `${f.fileName} · ${size} — click to view` : `${f.fileName} — click to view`}
                    aria-label={`View image ${i + 1} of ${entry.files.length}: ${f.fileName}`}
                  >
                    <img
                      src={fileHref(f.fileUrl)}
                      alt={f.fileName}
                      className={styles.thumbImg}
                      loading="lazy"
                    />
                    <span className={styles.thumbOverlay} aria-hidden>
                      <ImageIcon size={16} />
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </>
  );
}
