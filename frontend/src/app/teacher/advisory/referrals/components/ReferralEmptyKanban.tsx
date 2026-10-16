"use client";

import Link from "next/link";
import { FileText, Info, Send } from "lucide-react";
import { StudentMascot } from "@/components/student-mascot/StudentMascot";
import { Button } from "@/components/ui/button";
import refStyles from "./referrals.module.css";

function BamaMascot({ size = 14 }: { size?: number }) {
  return (
    <span className="inline-flex shrink-0 items-center" aria-hidden>
      <StudentMascot name="Bama" character="crt" size={size} />
    </span>
  );
}

const STATUS_ENTRIES: { key: string; label: string; color: string }[] = [
  { key: "pending", label: "Pending", color: "#f59e0b" },
  { key: "in_progress", label: "In progress", color: "#3b82f6" },
  { key: "info_requested", label: "Info requested", color: "#3b82f6" },
  { key: "follow_up", label: "Follow up", color: "#f59e0b" },
  { key: "resolved", label: "Resolved", color: "#22c55e" },
  { key: "dismissed", label: "Cancelled", color: "#ef4444" },
  { key: "rejected", label: "Rejected", color: "#ef4444" },
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
      aria-label={action ? title : `${title}, ${count}`}
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

function LinkCard({
  href,
  title,
  description,
  icon,
  newTab = false,
  mascot = false,
}: {
  href: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ size?: number | string; className?: string; "aria-hidden"?: boolean | "true" | "false" }>;
  newTab?: boolean;
  mascot?: boolean;
}) {
  const Icon = icon;
  return (
    <Link
      href={href}
      {...(newTab ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      aria-label={`Open ${title}${newTab ? " (opens in a new tab)" : ""}`}
      className="flex min-w-0 cursor-pointer flex-col gap-1.5 rounded-lg border bg-white p-3 shadow-sm transition-colors [font-family:var(--font-inter)] hover:border-primary/60 hover:shadow dark:bg-card"
    >
      <span className="flex items-center justify-between gap-2">
        <span className="truncate text-[11px] font-medium text-muted-foreground" title={href}>
          {href}
        </span>
        <span
          className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-muted-foreground"
          aria-hidden
        >
          {mascot ? <BamaMascot size={20} /> : <Icon size={13} />}
        </span>
      </span>
      <span className="truncate text-sm font-semibold leading-snug" title={title}>
        {title}
      </span>
      <span className="text-xs leading-snug text-muted-foreground">{description}</span>
    </Link>
  );
}

export function ReferralStarterKanban({
  onNewReferral,
  singleRow = false,
}: {
  onNewReferral?: () => void;
  /** One row of four (used as the bottom strip on the filled view). */
  singleRow?: boolean;
}) {
  return (
    <div
      className={singleRow ? refStyles.stripGrid : refStyles.kanbanGrid}
      role="group"
      aria-label="Referral starter actions"
    >
          <div
            className="flex min-w-0 flex-col gap-2 rounded-xl border border-border bg-muted/60 p-2.5 [font-family:var(--font-inter)] dark:bg-muted/20"
            aria-label="New Referral"
          >
            <ColumnHead
              icon={<Send size={14} aria-hidden className="text-blue-500" />}
              title="New Referral"
              action={
                <Button
                  type="button"
                  variant="outline"
                  className="h-6 px-2 text-[11px]"
                  onClick={onNewReferral}
                >
                  Refer now
                </Button>
              }
            />
            <button
              type="button"
              onClick={onNewReferral}
              aria-label="Start a new referral"
              className="flex min-w-0 flex-1 cursor-pointer flex-col gap-1.5 rounded-lg border bg-white p-3 text-left shadow-sm transition-colors [font-family:var(--font-inter)] hover:border-primary/60 hover:shadow dark:bg-card"
            >
              <span className="flex items-center justify-between gap-2">
                <span className="truncate text-[11px] font-medium text-muted-foreground" title="action/new-referral">
                  action/new-referral
                </span>
                <span
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"
                  aria-hidden
                >
                  <Send size={13} />
                </span>
              </span>
              <span className="truncate text-sm font-semibold leading-snug" title="New Referral">
                New Referral
              </span>
              <span className="text-xs leading-snug text-muted-foreground">
                Refer from an anecdotal record to the right desk
              </span>
            </button>
          </div>

          <div
            className="flex min-w-0 flex-col gap-2 rounded-xl border border-border bg-muted/60 p-2.5 [font-family:var(--font-inter)] dark:bg-muted/20"
            aria-label="Anecdotal Records"
          >
            <ColumnHead
              icon={<FileText size={14} aria-hidden className="text-amber-500" />}
              title="Anecdotal Records"
              action={
                <Button asChild variant="outline" className="h-6 px-2 text-[11px]">
                  <Link href="/teacher/anecdotal">See all</Link>
                </Button>
              }
            />
            <ul className="flex min-w-0 flex-1 flex-col gap-2">
              <li className="flex min-w-0 flex-col">
                <LinkCard
                  href="/teacher/anecdotal"
                  title="Anecdotal Records"
                  description="Referrals start from a filed GCForm-01 record"
                  icon={FileText}
                />
              </li>
            </ul>
          </div>

          <div
            className="flex min-w-0 flex-col gap-2 rounded-xl border border-border bg-muted/60 p-2.5 [font-family:var(--font-inter)] dark:bg-muted/20"
            aria-label="Chat with Bama"
          >
            <ColumnHead
              icon={<BamaMascot size={16} />}
              title="Chat with Bama"
              action={
                <Button asChild variant="outline" className="h-6 px-2 text-[11px]">
                  <Link href="/teacher/chat?standalone=1" target="_blank" rel="noopener noreferrer">
                    Chat now
                  </Link>
                </Button>
              }
            />
            <ul className="flex min-w-0 flex-1 flex-col gap-2">
              <li className="flex min-w-0 flex-col">
                <LinkCard
                  href="/teacher/chat?standalone=1"
                  title="Chat with Bama"
                  description="File an anecdotal record first, then refer it"
                  icon={Send}
                  newTab
                  mascot
                />
              </li>
            </ul>
          </div>

          <div
            className="flex min-w-0 flex-col gap-2 rounded-xl border border-border bg-muted/60 p-2.5 [font-family:var(--font-inter)] dark:bg-muted/20"
            aria-label={`Status Legend, ${STATUS_ENTRIES.length}`}
          >
            <ColumnHead
              icon={<Info size={14} aria-hidden className="text-amber-500" />}
              title="Status Legend"
              count={STATUS_ENTRIES.length}
            />
            <ul
              className="flex min-w-0 flex-1 flex-row flex-wrap content-center items-center justify-center gap-1.5"
              aria-label="Referral status legend"
            >
              {STATUS_ENTRIES.map((e) => (
                <li key={e.key} className="flex">
                  <span
                    className="inline-flex items-center rounded-md border px-2.5 py-1 text-[10px] font-semibold leading-tight"
                    style={{
                      color: e.color,
                      borderColor: `color-mix(in srgb, ${e.color} 40%, transparent)`,
                      backgroundColor: `color-mix(in srgb, ${e.color} 12%, transparent)`,
                    }}
                    title={e.label}
                  >
                    {e.label}
                  </span>
                </li>
              ))}
            </ul>
          </div>
    </div>
  );
}

export function ReferralEmptyKanban({ onNewReferral }: { onNewReferral?: () => void }) {
  return (
    <section aria-labelledby="referral-empty-board" className="flex min-w-0 flex-col gap-3">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-3">
        <div>
          <h2 id="referral-empty-board" className="m-0 text-[0.9375rem] font-bold tracking-[-0.01em] text-foreground">
            No referrals yet
          </h2>
          <p className="m-0 text-[0.8125rem] leading-[1.45] text-muted-foreground">
            Referrals you submit will appear here once created. Pick a starting point below.
          </p>
        </div>
        <ReferralStarterKanban onNewReferral={onNewReferral} />
      </div>
    </section>
  );
}
