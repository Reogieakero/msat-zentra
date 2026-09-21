"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import styles from "./ImageViewer.module.css";

export interface ViewerImage {
  id: string;
  fileUrl: string;
  fileName: string;
}

interface ImageViewerProps {
  files: ViewerImage[];
  index: number;
  /** Student name shown in the header. */
  title: string;
  /** LRN · section line under the title. */
  subtitle?: string;
  /** Resolve relative storage URLs (defaults to the URL as-is). */
  resolveHref?: (fileUrl: string) => string;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}

/**
 * Shared fullscreen image viewer — same gallery on the nurse health-records
 * desk and the guidance interventions desk. Arrow-key navigation, counter,
 * and a z-index above dialogs so it covers everything. Portaled to
 * document.body so it never lands as a DOM child of a <table> section when
 * opened from a table row (a <div> inside <tbody> breaks hydration).
 */
export function ImageViewer({
  files,
  index,
  title,
  subtitle,
  resolveHref = (url) => url,
  onIndexChange,
  onClose,
}: ImageViewerProps) {
  const count = files.length;
  const safeIndex = count === 0 ? 0 : Math.min(Math.max(index, 0), count - 1);
  const current = files[safeIndex];
  // Portal target is client-only — false through SSR/first paint so the
  // server HTML and the first client render agree, true afterwards.
  const mounted = React.useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" && count > 1) onIndexChange((safeIndex + 1) % count);
      if (e.key === "ArrowLeft" && count > 1) onIndexChange((safeIndex - 1 + count) % count);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [count, safeIndex, onClose, onIndexChange]);

  if (!current || !mounted) return null;

  return createPortal(
    <div
      className={styles.viewerBackdrop}
      role="dialog"
      aria-modal="true"
      aria-label={`Image viewer for ${title} — ${safeIndex + 1} of ${count}`}
      onClick={onClose}
    >
      <div className={styles.viewerContent} onClick={(e) => e.stopPropagation()}>
        <Button variant="ghost" size="icon-sm" className="absolute top-2 right-2" onClick={onClose} aria-label="Close">
          <X aria-hidden />
          <span className="sr-only">Close</span>
        </Button>
        <div className={styles.viewerHead}>
          <p className={styles.viewerStudent}>{title}</p>
          {subtitle ? <p className={styles.viewerSub}>{subtitle}</p> : null}
        </div>
        {count > 1 && (
          <button
            type="button"
            className={`${styles.viewerNav} ${styles.viewerPrev}`}
            onClick={() => onIndexChange((safeIndex - 1 + count) % count)}
            aria-label="Previous image"
          >
            <ChevronLeft size={22} aria-hidden />
          </button>
        )}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={current.id}
          src={resolveHref(current.fileUrl)}
          alt={current.fileName}
          className={styles.viewerImage}
        />
        {count > 1 && (
          <button
            type="button"
            className={`${styles.viewerNav} ${styles.viewerNext}`}
            onClick={() => onIndexChange((safeIndex + 1) % count)}
            aria-label="Next image"
          >
            <ChevronRight size={22} aria-hidden />
          </button>
        )}
        <div className={styles.viewerFooter}>
          <p className={styles.viewerName}>{current.fileName}</p>
          {count > 1 && (
            <p className={styles.viewerCounter} aria-live="polite">
              {safeIndex + 1} / {count}
            </p>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
