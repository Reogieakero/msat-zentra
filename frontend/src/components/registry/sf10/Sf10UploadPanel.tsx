"use client";

import * as React from "react";
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  Loader2,
  UploadCloud,
  X,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { GRADE_LABEL } from "@/services/registry/sf10.types";
import { useSf10BulkUpload } from "@/components/registry/sf10/sf10-bulk-upload-context";
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";

import styles from "./sf10.module.css";

const GRADES = ["G7", "G8", "G9", "G10", "G11", "G12"];

export function Sf10UploadPanel({
  onChanged,
  onUploaded,
}: {
  onChanged?: () => void;
  /** Called with each filed record id (last call wins for single-record views). */
  onUploaded?: (id: string) => void;
}) {
  const bulk = useSf10BulkUpload();
  const { items, uploading, progress } = bulk;
  const [dragging, setDragging] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Compat: the upload page tracks filed records through these callbacks.
  // The queue itself lives in the root provider so runs survive navigation.
  const seenFiled = React.useRef(0);
  React.useEffect(() => {
    if (bulk.filedIds.length > seenFiled.current) {
      const fresh = bulk.filedIds.slice(seenFiled.current);
      seenFiled.current = bulk.filedIds.length;
      onChanged?.();
      fresh.forEach((id) => onUploaded?.(id));
    } else if (bulk.filedIds.length < seenFiled.current) {
      seenFiled.current = bulk.filedIds.length;
    }
  }, [bulk.filedIds, onChanged, onUploaded]);

  const handleFiles = (files: FileList | null) => {
    bulk.enqueueFiles(files ?? []);
    if (inputRef.current) inputRef.current.value = "";
  };

  const actionableCount = items.filter(
    (i) => i.status === "queued" || i.status === "error" || (i.status === "needs-grade" && i.gradeLevel),
  ).length;
  const doneItems = items.filter((i) => i.status === "done").length;
  const needsGradeBlocked = items.some((i) => i.status === "needs-grade" && !i.gradeLevel);

  return (
    <section className={assign.card} aria-labelledby="sf10-upload">
      <span className={assign.glowClip} aria-hidden="true">
        <span className={assign.cardGlow} />
      </span>
      <div className="relative">
        <h2 id="sf10-upload" className="text-base font-semibold">
          Upload SF10
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Attach SF10 files in bulk (PDF, JPG, PNG, or XLSX) — select many at
          once like Drive. The learner, the subjects, and each record&apos;s
          grade level are read from the files first — then filed automatically.
          Uploads keep running in the bottom-right dock even if you leave this page.
        </p>
      </div>

      <div
        className={`${styles.dropzone} ${dragging ? styles.dropzoneActive : ""} relative`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        aria-label="Attach SF10 files"
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.xlsx"
          multiple
          className={styles.fileInput}
          onChange={(e) => handleFiles(e.target.files)}
        />
        <span className={styles.dropIcon}>
          <UploadCloud />
        </span>
        <p className={styles.dropTitle}>
          {items.length === 0
            ? "Drag & drop SF10 files"
            : `${items.length} file${items.length === 1 ? "" : "s"} selected · ${doneItems} done`}
        </p>
        <p className={styles.dropHint}>PDF, JPG, PNG, or XLSX · select many or drop a batch · or click to browse</p>
      </div>

      {items.length > 0 ? (
        <ul className="relative flex max-h-72 min-w-0 flex-col gap-1 overflow-y-auto rounded-md border p-2" aria-label="Upload queue">
          {items.map((item) => (
            <li
              key={item.key}
              className="flex min-w-0 items-start gap-2.5 rounded px-1.5 py-1.5 hover:bg-muted/50"
            >
              <span className="mt-0.5 shrink-0" aria-hidden>
                {item.status === "done" ? (
                  <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400" />
                ) : item.status === "uploading" ? (
                  <Loader2 size={16} className="animate-spin text-muted-foreground" />
                ) : item.status === "needs-grade" ? (
                  <AlertTriangle size={16} className="text-amber-600 dark:text-amber-400" />
                ) : item.status === "error" ? (
                  <XCircle size={16} className="text-destructive" />
                ) : (
                  <FileText size={16} className="text-muted-foreground" />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium" title={item.file.name}>
                  {item.file.name}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {item.status === "done"
                    ? `${item.learnerName ?? "Filed"}${item.lrn ? ` · LRN ${item.lrn}` : ""}`
                    : item.status === "uploading"
                      ? "Uploading…"
                      : item.status === "needs-grade"
                        ? (item.error ?? "Pick the grade this record covers, then upload again.")
                        : item.status === "error"
                          ? (item.error ?? "Upload failed.")
                          : `${(item.file.size / 1024).toFixed(0)} KB · queued`}
                </span>
                {item.status === "needs-grade" ? (
                  <label className="mt-1 flex flex-col gap-1 text-xs">
                    <span className="font-medium">Grade this record covers</span>
                    <select
                      className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                      value={item.gradeLevel}
                      onChange={(e) => bulk.setItemGrade(item.key, e.target.value)}
                      aria-label={`Grade for ${item.file.name}`}
                    >
                      <option value="">Select grade…</option>
                      {GRADES.map((g) => (
                        <option key={g} value={g}>
                          {GRADE_LABEL[g] ?? g}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 shrink-0 px-2"
                onClick={(e) => {
                  e.stopPropagation();
                  bulk.cancelItem(item.key);
                }}
                aria-label={`Cancel ${item.file.name}`}
                title={`Cancel ${item.file.name}`}
              >
                <X size={14} aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      ) : null}

      {needsGradeBlocked && !uploading ? (
        <p className="relative text-xs text-amber-600 dark:text-amber-400" role="alert">
          Some files need a grade before they can be filed — pick each grade, then upload again.
        </p>
      ) : null}

      <div className={`${styles.uploadActions} relative`}>
        <Button type="button" variant="outline" size="sm" onClick={bulk.clearDone} disabled={uploading || doneItems === 0}>
          Clear done
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={bulk.clearAll} disabled={uploading || items.length === 0}>
          Clear
        </Button>
        <Button type="button" size="sm" onClick={bulk.startUpload} disabled={uploading || actionableCount === 0}>
          {uploading ? `Uploading ${progress.done + 1} of ${progress.total}…` : `Upload ${actionableCount > 0 ? `(${actionableCount})` : ""}`}
        </Button>
      </div>
    </section>
  );
}
