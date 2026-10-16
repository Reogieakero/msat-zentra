"use client";

import * as React from "react";

export function KanbanBoardHeader({
  icon,
  title,
  count,
  actions,
  ariaLabel,
}: {
  icon?: React.ReactNode;
  title: React.ReactNode;
  count?: React.ReactNode;
  actions?: React.ReactNode;
  ariaLabel?: string;
}) {
  return (
    <div
      className="-mx-2.5 flex items-center justify-between gap-2 border-b border-border px-3.5 pb-2"
      aria-label={ariaLabel}
    >
      <span className="inline-flex min-w-0 items-center gap-1.5 text-[13px] font-semibold text-muted-foreground">
        {icon}
        <span className="truncate">{title}</span>
      </span>
      <span className="flex shrink-0 items-center gap-2">
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
          ariaLabel={
            typeof title === "string" && count !== undefined
              ? `${title}, ${String(count)}`
              : undefined
          }
        />
        {description ? (
          <div className="px-1 text-xs text-muted-foreground">{description}</div>
        ) : null}
        {toolbar ?? null}
        {children}
        {footer ?? null}
      </div>
    </section>
  );
}
