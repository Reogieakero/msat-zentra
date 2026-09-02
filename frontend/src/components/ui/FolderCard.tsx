import * as React from "react";
import { FileBarChart, FileCode, FileImage, FileText, FileVideo } from "lucide-react";
import styles from "./folder-card.module.css";

export interface FolderFile {
  name: string;
  tag: string;
  tone?: 1 | 2 | 3 | 4 | 5;
  icon?: "image" | "video" | "code" | "doc" | "chart";
}

const FILE_ICONS: Record<NonNullable<FolderFile["icon"]>, React.ComponentType<{ className?: string }>> = {
  image: FileImage,
  video: FileVideo,
  code: FileCode,
  doc: FileText,
  chart: FileBarChart,
};

interface FolderCardProps {
  label: string;
  sublabel?: string;
  files: FolderFile[];
}

export function FolderCard({ label, sublabel, files }: FolderCardProps) {
  const count = files.length;

  return (
    <div className={styles.card}>
      <div className={styles.folder}>
        <div className={styles.canvas}>
          <svg className={styles.back} viewBox="0 0 50 40" fill="none" aria-hidden>
            <path
              d="M0 4C0 1.79086 1.79086 0 4 0H16.524C17.721 0 18.8415 0.54051 19.574 1.4673L22.426 5.0654C23.1585 5.99219 24.279 6.5327 25.476 6.5327H46C48.2091 6.5327 50 8.32356 50 10.5327V36C50 38.2091 48.2091 40 46 40H4C1.79086 40 0 38.2091 0 36V4Z"
              fill="currentColor"
            />
          </svg>

          {files.slice(0, 5).map((file, i) => {
            const Icon = FILE_ICONS[file.icon ?? "doc"];
            const tone = file.tone ?? (((i % 5) + 1) as FolderFile["tone"]);
            return (
              <div key={i} className={`${styles.file} ${styles[`tone${tone}`]}`}>
                <div className={styles.shine} aria-hidden />
                <Icon className={styles.fileIcon} aria-hidden />
                <div className={styles.fileText}>{file.name}</div>
                <div className={styles.fileTag}>{file.tag}</div>
              </div>
            );
          })}

          <div className={styles.frontWrapper}>
            <svg
              className={styles.front}
              viewBox="0 0 50 34"
              fill="none"
              aria-hidden
            >
              <path
                d="M0 4C0 1.79086 1.79086 0 4 0H46C48.2091 0 50 1.79086 50 4V30C50 32.2091 48.2091 34 46 34H4C1.79086 34 0 32.2091 0 30V4Z"
                fill="currentColor"
              />
            </svg>
            <div className={styles.label} aria-hidden />
            {count > 0 && (
              <div className={styles.counter}>
                <span className={styles.counterDot} aria-hidden />
                <span className={styles.counterText}>file{count !== 1 ? "s" : ""}</span>
                <span className={styles.counterNumber}>{String(count).padStart(2, "0")}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {(label || sublabel) && (
        <div className={styles.caption}>
          {label && <span className={styles.captionName}>{label}</span>}
          {sublabel && <span className={styles.captionSub}>{sublabel}</span>}
        </div>
      )}
    </div>
  );
}