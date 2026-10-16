"use client";

import * as React from "react";
import Link from "next/link";
import styles from "./teacher-overview-actions.module.css";

export interface QuickAction {
  title: string;
  description: string;
  href: string;
  icon: React.ComponentType<{ className?: string; size?: number | string }>;
}

interface TeacherOverviewActionsProps {
  actions: QuickAction[];
  compact?: boolean;
  row?: boolean;
}

const COLUMN_ACCENTS = ["text-amber-500", "text-blue-500", "text-emerald-600 dark:text-emerald-400", "text-red-600 dark:text-red-400"];

function ColumnHead({
  icon,
  title,
  count,
}: {
  icon: React.ReactNode;
  title: string;
  count: number;
}) {
  return (
    <div className="-mx-2.5 flex items-center justify-between gap-2 border-b border-border px-3.5 pb-2" aria-label={`${title}, ${count} action`}>
      <span className="inline-flex min-w-0 items-center gap-1.5 text-[13px] font-semibold">
        {icon} <span className="truncate">{title}</span>
      </span>
      <span className="text-xs font-semibold text-muted-foreground">{count}</span>
    </div>
  );
}

function ActionCard({ action }: { action: QuickAction }) {
  const Icon = action.icon;
  return (
    <li className="flex min-w-0 flex-col">
      <Link
        href={action.href}
        aria-label={`Open ${action.title}`}
        className="flex min-w-0 cursor-pointer flex-col gap-1.5 rounded-lg border bg-white p-3 shadow-sm transition-colors hover:border-primary/60 hover:shadow dark:bg-card"
      >
        <span className="flex items-center justify-between gap-2">
          <span className="truncate font-mono text-[11px] font-medium text-muted-foreground" title={action.href}>
            {action.href}
          </span>
          <span
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"
            aria-hidden
          >
            <Icon size={13} />
          </span>
        </span>
        <span className="truncate text-sm font-semibold leading-snug" title={action.title}>
          {action.title}
        </span>
        <span className="text-xs leading-snug text-muted-foreground">{action.description}</span>
      </Link>
    </li>
  );
}

export function TeacherOverviewActions({ actions }: TeacherOverviewActionsProps) {
  return (
    <section aria-labelledby="quick-actions-board" className={styles.section}>
      <div className={styles.head}>
        <h2 id="quick-actions-board" className={styles.title}>Start your day</h2>
        <p className={styles.subtitle}>
          Jump straight into today&apos;s classroom tasks. {actions.length} actions.
        </p>
      </div>
      {actions.length === 0 ? (
        <p className={styles.empty}>No classroom tasks right now.</p>
      ) : (
        <div
          className={styles.kanbanGrid}
          style={{ ["--cols" as string]: actions.length }}
        >
          {actions.map((action, i) => (
            <div
              key={action.title}
              className="flex min-w-0 flex-col gap-2 rounded-xl border border-border bg-muted/60 p-2.5 dark:bg-muted/20"
              aria-label={`${action.title}, 1 action`}
            >
              <ColumnHead
                icon={<action.icon size={14} aria-hidden className={COLUMN_ACCENTS[i % COLUMN_ACCENTS.length]} />}
                title={action.title}
                count={1}
              />
              <ul className="flex min-w-0 flex-col gap-2">
                <ActionCard action={action} />
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
