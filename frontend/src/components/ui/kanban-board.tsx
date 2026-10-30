"use client";

import * as React from "react";

export function KanbanBoardHeader({
  icon,
  title,
  count,
  actions,
  center,
  toolbar,
  ariaLabel,
}: {
  icon?: React.ReactNode;
  title: React.ReactNode;
  count?: React.ReactNode;
  actions?: React.ReactNode;
  /** Slot centered in the title row (e.g. a status filter / view switcher). */
  center?: React.ReactNode;
  /** Wide controls (search + filters) that share the title row and wrap. */
  toolbar?: React.ReactNode;
  ariaLabel?: string;
}) {
  return (
    <div
      className="-mx-2.5 relative flex items-center gap-2 border-b border-border px-3.5 pb-2"
      aria-label={ariaLabel}
    >
      <span
        className={`inline-flex min-w-0 items-center gap-1.5 text-[13px] font-semibold text-muted-foreground ${
          toolbar ? "shrink-0" : "flex-1"
        }`}
      >
        {icon}
        <span className="truncate">{title}</span>
      </span>
      {toolbar ? (
        <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2">
          {toolbar}
        </div>
      ) : center ? (
        <div className="pointer-events-none absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center">
          <div className="pointer-events-auto flex items-center">{center}</div>
        </div>
      ) : null}
      {/* Right side hugs its content — the title keeps every spare pixel
          (a flex-1 here split the row 50/50 and clipped long titles). */}
      <span className="flex shrink-0 items-center justify-end gap-2">
        {actions ?? null}
        {count !== undefined ? (
          <span className="text-xs font-semibold text-muted-foreground">{count}</span>
        ) : null}
      </span>
    </div>
  );
}

export function KanbanBoardEmpty({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex min-h-24 flex-1 items-center justify-center px-1 py-8 text-center text-xs text-muted-foreground">
      {children}
    </p>
  );
}

interface KanbanBoardProps {
  title: React.ReactNode;
  icon?: React.ReactNode;
  count?: React.ReactNode;
  actions?: React.ReactNode;
  /** Centered in the title row — e.g. a status filter or view switcher. */
  headerCenter?: React.ReactNode;
  /** Search/filter strip that shares the title row (wraps when narrow). */
  headerToolbar?: React.ReactNode;
  description?: React.ReactNode;
  toolbar?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
  /** Override for the section aria-label. Defaults to title when title is a string. */
  ariaLabel?: string;
  /** Override for the inner card aria-label. */
  boardLabel?: string;
  className?: string;
  /** Tint for the inner board (e.g. status-tinted reminder cards). */
  style?: React.CSSProperties;
}

export function KanbanBoard({
  title,
  icon,
  count,
  actions,
  headerCenter,
  headerToolbar,
  description,
  toolbar,
  footer,
  children,
  ariaLabel,
  boardLabel,
  className,
  style,
}: KanbanBoardProps) {
  const sectionLabel = ariaLabel ?? (typeof title === "string" ? title : undefined);
  return (
    <section aria-label={sectionLabel} className="flex min-w-0 flex-col gap-3">
      <div
        className={`flex min-w-0 flex-col gap-2 rounded-xl border border-border p-2.5 ${className ?? ""}`}
        aria-label={boardLabel}
        style={style}
      >
        <KanbanBoardHeader
          icon={icon}
          title={title}
          count={count}
          actions={actions}
          center={headerCenter}
          toolbar={headerToolbar}
          ariaLabel={
            typeof title === "string" && count !== undefined
              ? `${title}, ${String(count)}`
              : undefined
          }
        />
        {description ? (
          <div className="px-1 text-xs text-muted-foreground whitespace-normal break-words">
            {description}
          </div>
        ) : null}
        {toolbar ?? null}
        {children}
        {footer ?? null}
      </div>
    </section>
  );
}
