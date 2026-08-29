"use client";

import * as React from "react";
import Link from "next/link";
import { UploadCloud, FileUp, Paperclip, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import styles from "./sf10-summary.module.css";
import type { RegistrarOverviewData, Sf10Student } from "./data";
import { formatRelativeTime } from "./data";

export function Sf10Summary({ data }: { data: RegistrarOverviewData }) {
  return (
    <section className={styles.section}>
      <div className={styles.split}>
        {/* Left: SF10 Records card (1/1 framing inside) */}
        <div className={styles.left}>
          <div className={`${styles.panel} ${styles.sf10Card}`}>
            <div className={styles.panelHead}>
              <h2 className={styles.panelTitle}>SF10 Records</h2>
              <Link href="/registrar/sf10" className={styles.openLink}>
                Open all
              </Link>
            </div>
            <div className={styles.twoCol}>
              <div className={styles.subCard}>
                <div className={styles.subHead}>
                  <Paperclip className={styles.subIcon} />
                  <span>Latest Attachments</span>
                </div>
                <ul className={styles.rowList}>
                  {data.latestAttachments.map((a) => (
                    <li key={a.lrn} className={styles.rowItem}>
                      <div className={styles.rowMeta}>
                        <span className={styles.rowName}>{a.student}</span>
                        <span className={styles.rowSub}>
                          {a.grade} · {a.lrn}
                        </span>
                      </div>
                      <span className={styles.rowTime}>{formatRelativeTime(a.when)}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className={styles.subCard}>
                <div className={styles.subHead}>
                  <AlertTriangle className={styles.subIconWarn} />
                  <span>Missing SF10 Reports</span>
                </div>
                {data.missingSf10.length === 0 ? (
                  <p className={styles.emptyState}>No missing SF10 reports</p>
                ) : (
                  <ul className={styles.rowList}>
                    {data.missingSf10.map((m) => (
                      <li key={m.lrn} className={styles.rowItem}>
                        <div className={styles.rowMeta}>
                          <span className={styles.rowName}>{m.student}</span>
                          <span className={styles.rowSub}>
                            {m.grade} · {m.lrn}
                          </span>
                        </div>
                        <Badge variant="destructive">Missing</Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right: request + upload */}
        <div className={styles.right}>
          <RequestByStudent students={data.sf10Students} />
          <UploadSf10 />
        </div>
      </div>
    </section>
  );
}

function RequestByStudent({ students }: { students: Sf10Student[] }) {
  const [selected, setSelected] = React.useState<Sf10Student | null>(null);

  return (
    <div className={styles.panel}>
      <div className={styles.panelHead}>
        <h3 className={styles.panelTitle}>Request SF10 by Student</h3>
        <Button asChild variant="link" size="xs" className={styles.viewAll}>
          <Link href="/registrar/sf10">View all</Link>
        </Button>
      </div>
      <ul className={styles.studentList}>
        {students.map((s) => (
          <li key={s.lrn}>
            <button
              type="button"
              className={`${styles.studentItem} ${
                selected?.lrn === s.lrn ? styles.studentItemActive : ""
              }`}
              onClick={() => setSelected(s)}
            >
              <span className={styles.studentName}>{s.name}</span>
              <span className={styles.studentMeta}>
                {s.grade} · {s.lrn}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <Button type="button" variant="default" className={styles.requestBtn} disabled={!selected}>
        {selected ? `Request SF10 for ${selected.name}` : "Select a student"}
      </Button>
    </div>
  );
}

function UploadSf10() {
  const [dragging, setDragging] = React.useState(false);
  const [fileName, setFileName] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleFiles = (files: FileList | null) => {
    if (files && files.length > 0) setFileName(files[0].name);
  };

  return (
    <div className={styles.panel}>
      <div className={styles.panelHead}>
        <h3 className={styles.panelTitle}>Upload SF10</h3>
        <Button asChild variant="link" size="xs" className={styles.viewAll}>
          <Link href="/registrar/sf10">View all</Link>
        </Button>
      </div>
      <div
        className={`${styles.dropzone} ${dragging ? styles.dropzoneActive : ""}`}
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
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          className={styles.fileInput}
          onChange={(e) => handleFiles(e.target.files)}
        />
        <span className={styles.dropIcon}>
          {fileName ? <FileUp className={styles.dropIconSvg} /> : <UploadCloud className={styles.dropIconSvg} />}
        </span>
        <p className={styles.dropTitle}>
          {fileName ? fileName : "Drag & drop SF10 file"}
        </p>
        <p className={styles.dropHint}>PDF, JPG or PNG · or click to browse</p>
      </div>
      <Button type="button" variant="default" className={styles.uploadBtn} disabled={!fileName}>
        {fileName ? "Scan & digitize" : "No file selected"}
      </Button>
    </div>
  );
}
