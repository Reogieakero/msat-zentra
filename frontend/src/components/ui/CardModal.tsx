"use client";

import * as React from "react";
import { X } from "lucide-react";
import { ScrollDownHint } from "./scroll-down-hint";
import { FireParticles } from "./fire-particles";
import styles from "./card-modal.module.css";

export type CardModalSize = "sm" | "md" | "lg";

interface CardModalProps {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  size?: CardModalSize;
  children: React.ReactNode;
  /* Identity for the scroll hint to re-check overflow when async content
     swaps (e.g. loading skeleton → loaded preview). */
  watchKey?: unknown;
  /* When false, X / overlay-click / Escape are all disabled so a
     processing action (e.g. approving) cannot be dismissed mid-flight.
     Defaults to true. */
  dismissable?: boolean;
}

/* Card modal — a dedicated modal card (overlay + glowing card), separate
   from the dialog UI component. Monochrome palette only. Closes on
   overlay click and Escape, locks body scroll while open, and moves
   focus into the card. */
export function CardModal({
  open,
  onClose,
  title,
  description,
  size = "md",
  children,
  watchKey,
  dismissable = true,
}: CardModalProps) {
  const cardRef = React.useRef<HTMLDivElement | null>(null);
  const bodyRef = React.useRef<HTMLDivElement | null>(null);

  /* Fire particles across the overlay background, rising bottom → top
     behind the card (shared FireParticles, 48 for fullscreen scale). */
  React.useEffect(() => {
    if (!open || !dismissable) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, dismissable]);

  React.useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    cardRef.current?.focus();
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open ]);

  if (!open) return null;

  return (
    <div
      className={styles.overlay}
      onMouseDown={(e) => {
        if (dismissable && e.target === e.currentTarget) onClose();
      }}
    >
      <FireParticles count={48} className={styles.particles} />
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === "string" ? title : undefined}
        tabIndex={-1}
        className={`${styles.card} ${styles[size]}`}
      >
        <span className={styles.glowClip} aria-hidden="true">
          <span className={styles.cardGlow} />
        </span>
        <div className={styles.header}>
          <div className={styles.headText}>
            <h2 className={styles.title}>{title}</h2>
            {description ? (
              <p className={styles.description}>{description}</p>
            ) : null}
          </div>
          <button
            type="button"
            className={styles.close}
            onClick={onClose}
            disabled={!dismissable}
            aria-label="Close dialog"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
        <div ref={bodyRef} className={styles.body}>
          {children}
        </div>
        <ScrollDownHint
          scrollRef={bodyRef}
          watchKey={watchKey}
          label="Scroll down"
          className={styles.scrollHint}
        />
      </div>
    </div>
  );
}
