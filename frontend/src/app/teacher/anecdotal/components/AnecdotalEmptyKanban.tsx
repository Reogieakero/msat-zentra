"use client";

import Link from "next/link";
import { FolderOpen, Info, Plus } from "lucide-react";
import { StudentMascot } from "@/components/student-mascot/StudentMascot";
import { Button } from "@/components/ui/button";
import { CATEGORY_COLORS } from "./AnecdotalSideRail";
import styles from "./anecdotal-empty-kanban.module.css";

function BamaMascot({ size = 14 }: { size?: number }) {
  return (
    <span className="inline-flex shrink-0 items-center" aria-hidden>
      <StudentMascot name="Bama" character="crt" size={size} />
    </span>
  );
}

export interface EmptyKanbanAction {
  title: string;
  description: string;
  href: string;
  icon: React.ComponentType<{ size?: number | string; className?: string; "aria-hidden"?: boolean | "true" | "false" }>;
  /** Chat with Bama entries always open the standalone chat in a new tab. */
  newTab?: boolean;
  /** Render the CRT Bama mascot instead of the lucide icon. */
  mascot?: boolean;
}

const COLUMN_ACCENTS = ["text-blue-500", "text-amber-500", "text-emerald-600 dark:text-emerald-400"];

const ACTIONS: EmptyKanbanAction[] = [
  {
    title: "Chat with Bama",
    description: "File through chat — Bama drafts the GCForm-01 for you",
    href: "/teacher/chat?standalone=1",
    icon: Plus,
    newTab: true,
    mascot: true,
  },
  {
    title: "New record",
    description: "Start a fresh anecdotal filing from the chat",
    href: "/teacher/chat?standalone=1&new=anecdotal",
    icon: Plus,
    newTab: true,
  },
  {
    title: "Record folders",
    description: "Open per-student folders once records are stored",
    href: "/teacher/anecdotal/folders",
    icon: FolderOpen,
  },
];

const LEGEND: { key: string; label: string; hint: string; color: string }[] = [
  { key: "behavioral", label: "Behavioral", hint: "Conduct and classroom behavior", color: CATEGORY_COLORS.behavioral },
  { key: "bullying", label: "Bullying", hint: "Peer conflict and bullying", color: CATEGORY_COLORS.bullying },
  { key: "academic", label: "Academic", hint: "Learning and performance", color: CATEGORY_COLORS.academic },
  { key: "attendance", label: "Attendance", hint: "Absences and tardiness", color: CATEGORY_COLORS.attendance },
  { key: "health", label: "Health", hint: "Wellness and clinic notes", color: CATEGORY_COLORS.health },
];

function ColumnHead({
  icon,
  title,
  count,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  count?: number;
  action?: React.ReactNode;
}) {
  return (
    <div
      className="-mx-2.5 flex items-center justify-between gap-2 border-b border-border px-3.5 pb-2"
      aria-label={action ? title : `${title}, ${count} action`}
    >
      <span className="inline-flex min-w-0 items-center gap-1.5 text-[13px] font-semibold">
        {icon} <span className="truncate">{title}</span>
      </span>
      <span className="flex shrink-0 items-center gap-1.5">
        {action ??
          (count !== undefined ? (
            <span className="text-xs font-semibold text-muted-foreground">{count}</span>
          ) : null)}
      </span>
    </div>
  );
}

function ActionCard({ action }: { action: EmptyKanbanAction }) {
  const Icon = action.icon;
  return (
    <li className="flex min-w-0 flex-col">
      <Link
        href={action.href}
        {...(action.newTab ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        aria-label={`Open ${action.title}${action.newTab ? " (opens in a new tab)" : ""}`}
        className="flex min-w-0 cursor-pointer flex-col gap-1.5 rounded-lg border bg-white p-3 shadow-sm transition-colors hover:border-primary/60 hover:shadow dark:bg-card"
      >
        <span className="flex items-center justify-between gap-2">
          <span className="truncate font-mono text-[11px] font-medium text-muted-foreground" title={action.href}>
            {action.href}
          </span>
          <span
            className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-muted-foreground"
            aria-hidden
          >
            {action.mascot ? <BamaMascot size={20} /> : <Icon size={13} />}
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

export function AnecdotalEmptyKanban() {
  return (
    <section aria-labelledby="anecdotal-empty-board" className={styles.section}>
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-3">
        <div className={styles.head}>
          <h2 id="anecdotal-empty-board" className={styles.title}>
            No files stored yet
          </h2>
          <p className={styles.subtitle}>
            Files you file through Chat with Bama will appear here once stored. Pick a starting point below.
          </p>
        </div>
        <div className={styles.kanbanGrid} style={{ ["--cols" as string]: 2 }}>
        {ACTIONS.map((actionItem, i) => (
          <div
            key={actionItem.title}
            className="flex min-w-0 flex-col gap-2 rounded-xl border border-border bg-muted/60 p-2.5 dark:bg-muted/20"
            aria-label={actionItem.title}
          >
            <ColumnHead
              icon={
                actionItem.mascot ? (
                  <BamaMascot size={16} />
                ) : (
                  <actionItem.icon size={14} aria-hidden className={COLUMN_ACCENTS[i % COLUMN_ACCENTS.length]} />
                )
              }
              title={actionItem.title}
              action={
                i === 0 ? (
                  <Button asChild variant="outline" className="h-6 px-2 text-[11px]">
                    <Link href="/teacher/chat?standalone=1" target="_blank" rel="noopener noreferrer">
                      Chat now
                    </Link>
                  </Button>
                ) : i === 1 ? (
                  <Button asChild variant="outline" className="h-6 w-6 px-0" aria-label="New record">
                    <Link
                      href="/teacher/chat?standalone=1&new=anecdotal"
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="New record (opens in a new tab)"
                    >
                      <Plus aria-hidden />
                    </Link>
                  </Button>
                ) : (
                  <Button asChild variant="outline" className="h-6 px-2 text-[11px]">
                    <Link href="/teacher/anecdotal/folders">See all</Link>
                  </Button>
                )
              }
            />
            <ul className="flex min-w-0 flex-1 flex-col gap-2">
              <ActionCard action={actionItem} />
            </ul>
          </div>
        ))}
        <div
          className="flex min-w-0 flex-col gap-2 rounded-xl border border-border bg-muted/60 p-2.5 dark:bg-muted/20"
          aria-label={`Legend, ${LEGEND.length}`}
        >
          <ColumnHead
            icon={<Info size={14} aria-hidden className="text-amber-500" />}
            title="Legend"
            count={LEGEND.length}
          />
          <ul className="flex min-w-0 flex-1 flex-row flex-wrap content-center items-center justify-center gap-1.5" aria-label="Legend categories">
            {LEGEND.map((e) => (
              <li key={e.key} className="flex">
                <span
                  className="inline-flex items-center rounded-md border px-2.5 py-1 text-[10px] font-semibold leading-tight"
                  style={{
                    color: e.color,
                    borderColor: `color-mix(in srgb, ${e.color} 40%, transparent)`,
                    backgroundColor: `color-mix(in srgb, ${e.color} 12%, transparent)`,
                  }}
                  title={`${e.label} — ${e.hint}`}
                >
                  {e.label}
                </span>
              </li>
            ))}
          </ul>
        </div>
        </div>
      </div>
    </section>
  );
}
