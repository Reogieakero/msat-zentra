"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { KanbanBoard } from "./kanban-board";
import styles from "./kanban-overlay.module.css";

export type KanbanPillTone =
  | "secondary"
  | "accent"
  | "success"
  | "warning"
  | "danger";

const PILL_TONES: Record<KanbanPillTone, string> = {
  secondary: "border-border bg-secondary text-secondary-foreground",
  accent: "border-primary/40 bg-primary/10 text-primary",
  success:
    "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  warning:
    "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  danger:
    "border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400",
};

/** Small rectangle pill used on every desk overlay / board row. */
export function KanbanPill({
  children,
  tone = "secondary",
  title,
  className,
}: {
  children: React.ReactNode;
  tone?: KanbanPillTone;
  title?: string;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-md border px-1.5 py-0.5 text-xs font-medium whitespace-nowrap ${PILL_TONES[tone]} ${className ?? ""}`}
      title={title}
    >
      {children}
    </span>
  );
}

const WIDTHS = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-3xl",
} as const;

interface KanbanOverlayProps {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  ariaLabel?: string;
  icon?: React.ReactNode;
  /** Extra pills/actions rendered left of the 24px close X. */
  headerActions?: React.ReactNode;
  description?: React.ReactNode;
  toolbar?: React.ReactNode;
  footer?: React.ReactNode;
  children?: React.ReactNode;
  /** Blocks Escape / backdrop close (e.g. a request still settling). */
  dismissable?: boolean;
  width?: keyof typeof WIDTHS;
  /** Scroll the body when the content is taller than the viewport. */
  scrollBody?: boolean;
  busy?: boolean;
  className?: string;
}

/**
 * Kanban-board styled modal overlay used by the desk confirmations and
 * detail sheets: backdrop + centered KanbanBoard card, 24px close X, and a
 * footer slot for 24px action buttons.
 */
export function KanbanOverlay({
  open,
  onClose,
  title,
  ariaLabel,
  icon,
  headerActions,
  description,
  toolbar,
  footer,
  children,
  dismissable = true,
  width = "md",
  scrollBody = true,
  busy,
  className,
}: KanbanOverlayProps) {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    // Guards the document.body portal during prerender.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  React.useEffect(() => {
    if (!open || !dismissable) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, dismissable, onClose]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-busy={busy || undefined}
      aria-label={ariaLabel ?? (typeof title === "string" ? title : undefined)}
    >
      <button
        type="button"
        aria-label="Close dialog"
        onClick={onClose}
        disabled={!dismissable}
        className="absolute inset-0 cursor-default bg-black/55 backdrop-blur-[2px] dark:bg-black/70"
      />
      <div className={`relative w-full ${WIDTHS[width]}`}>
        <KanbanBoard
          className={`bg-card shadow-2xl ${className ?? ""}`}
          title={title}
          icon={icon}
          description={description}
          toolbar={toolbar}
          footer={footer}
          actions={
            <>
              {headerActions}
              <button
                type="button"
                onClick={onClose}
                disabled={!dismissable}
                aria-label="Close dialog"
                className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
              >
                <X size={14} aria-hidden="true" />
              </button>
            </>
          }
        >
          {scrollBody ? (
            <div className={`max-h-[65vh] overflow-y-auto pr-0.5 ${styles.scrollBody}`}>
              {children}
            </div>
          ) : (
            children
          )}
        </KanbanBoard>
      </div>
    </div>,
    document.body,
  );
}
