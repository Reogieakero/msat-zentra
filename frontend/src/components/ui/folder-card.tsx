"use client";

import * as React from "react";
import styles from "./folder-card.module.css";

function FileIcon({ icon }: { icon: "image" | "video" | "code" | "pdf" | "ppt" }) {
  if (icon === "image")
    return (
      <svg className={styles.fileIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <polyline points="21 15 16 10 5 21" />
      </svg>
    );
  if (icon === "video")
    return (
      <svg className={styles.fileIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <polygon points="23 7 16 12 23 17 23 7" />
        <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
      </svg>
    );
  if (icon === "code")
    return (
      <svg className={styles.fileIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <polyline points="16 18 22 12 16 6" />
        <polyline points="8 6 2 12 8 18" />
      </svg>
    );
  if (icon === "ppt")
    return (
      <svg className={styles.fileIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
        <line x1="8" y1="21" x2="16" y2="21" />
        <line x1="12" y1="17" x2="12" y2="21" />
      </svg>
    );
  return (
    <svg className={styles.fileIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}

export type FolderFile = {
  name: string;
  type: string;
  size: string;
  color: string;
  icon: "image" | "video" | "code" | "pdf" | "ppt";
};

/**
 * Generic folder card (adapted from the Uiverse folder visual). Renders a
 * stack of files inside a folder; the whole card is clickable. Reused by the
 * principal/ADM approvals repository and the registrar SF10 repository.
 */
export function FolderCard({
  files,
  folderColor = "rgba(0, 123, 255, 0.65)",
  label,
  onOpen,
}: {
  files: FolderFile[];
  folderColor?: string;
  label?: string;
  onOpen?: () => void;
}) {
  const shown = files.slice(0, 5);
  return (
    <div
      className={styles.folderCard}
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen?.();
        }
      }}
      aria-label={label ? `Open ${label} folder` : "Open folder"}
    >
      <div className={styles.folderContainer}>
        <svg className={styles.folderBack} viewBox="0 0 50 40" fill="none">
          <path
            d="M0 4C0 1.79086 1.79086 0 4 0H16.524C17.721 0 18.8415 0.54051 19.574 1.4673L22.426 5.0654C23.1585 5.99219 24.279 6.5327 25.476 6.5327H46C48.2091 6.5327 50 8.32356 50 10.5327V36C50 38.2091 48.2091 40 46 40H4C1.79086 40 0 38.2091 0 36V4Z"
            fill={folderColor}
          />
        </svg>

        {shown.length === 1 ? (
          <div className={`${styles.file} ${styles.fileOnly}`}>
            <div className={styles.shine} />
            <FileIcon icon={shown[0].icon} />
            <div className={styles.fileText}>{shown[0].name}</div>
            <div className={styles.fileCaption}>{shown[0].type}</div>
            <div className={styles.fileTag}>
              {shown[0].type} • {shown[0].size}
            </div>
          </div>
        ) : (
          shown.map((f, i) => (
            <div
              key={f.name}
              className={`${styles.file} ${styles[`file${i + 1}` as "file1"]}`}
            >
              <div className={styles.shine} />
              <FileIcon icon={f.icon} />
              <div className={styles.fileText}>{f.name}</div>
              <div className={styles.fileCaption}>{f.type}</div>
              <div className={styles.fileTag}>
                {f.type} • {f.size}
              </div>
            </div>
          ))
        )}

        <div className={styles.folderFrontWrapper}>
          <svg className={styles.folderFront} viewBox="0 0 50 34" fill="none">
            <path
              d="M0 4C0 1.79086 1.79086 0 4 0H46C48.2091 0 50 1.79086 50 4V30C50 32.2091 48.2091 34 46 34H4C1.79086 34 0 32.2091 0 30V4Z"
              fill={folderColor}
            />
          </svg>
          <div className={styles.folderLabel} />
        </div>
      </div>
    </div>
  );
}
