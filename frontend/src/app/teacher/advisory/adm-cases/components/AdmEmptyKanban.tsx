"use client";

import Link from "next/link";
import { FileText, Info, Route, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { stageColor } from "@/services/teacher/admCases.labels";
import refStyles from "../../referrals/components/referrals.module.css";

const ADM_STAGE_ENTRIES: { key: string; label: string; color: string; title: string }[] = [
  { key: "anecdotal", label: "Anecdotal", color: stageColor("anecdotal"), title: "Stage 1 · Anecdotal Report Filed" },
  { key: "consultation", label: "Consultation", color: stageColor("consultation"), title: "Stage 2 · Consultation & Referral" },
  { key: "meeting_parents", label: "Meeting", color: stageColor("meeting_parents"), title: "Stage 3 · Meeting with Parents/Guardians" },
  { key: "home_visitation", label: "Home Visit", color: stageColor("home_visitation"), title: "Stage 4 · Home Visitation (if no meeting)" },
  { key: "certification", label: "Certification", color: stageColor("certification"), title: "Stage 5 · Recommendation & Certification" },
  { key: "principal_approval", label: "Approval", color: stageColor("principal_approval"), title: "Stage 6 · School Head (Principal) Approval" },
  { key: "enrollment_monitoring", label: "Modules", color: stageColor("enrollment_monitoring"), title: "Stage 7 · Modules Completed & Returned" },
  { key: "completion", label: "Closed", color: stageColor("completion"), title: "Stage 8 · Case Closed" },
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
}: {
  href: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ size?: number | string; className?: string; "aria-hidden"?: boolean | "true" | "false" }>;
}) {
  const Icon = icon;
  return (
    <Link
      href={href}
      aria-label={`Open ${title}`}
      className="flex min-w-0 cursor-pointer flex-col gap-1.5 rounded-lg border bg-white p-3 shadow-sm transition-colors [font-family:var(--font-inter)] hover:border-primary/60 hover:shadow dark:bg-card"
    >
      <span className="flex items-center justify-between gap-2">
        <span className="truncate text-[11px] font-medium text-muted-foreground" title={href}>
          {href}
        </span>
        <span
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"
          aria-hidden
        >
          <Icon size={13} />
        </span>
      </span>
      <span className="truncate text-sm font-semibold leading-snug" title={title}>
        {title}
      </span>
      <span className="text-xs leading-snug text-muted-foreground">{description}</span>
    </Link>
  );
}

export function AdmStarterKanban({
  onReferAdm,
  singleRow = false,
}: {
  onReferAdm?: () => void;
  /** One row of four (used as the bottom strip on the filled view). */
  singleRow?: boolean;
}) {
  return (
    <div
      className={singleRow ? refStyles.stripGrid : refStyles.kanbanGrid}
      role="group"
      aria-label="ADM starter actions"
    >
      <div
        className="flex min-w-0 flex-col gap-2 rounded-xl border border-border bg-muted/60 p-2.5 [font-family:var(--font-inter)] dark:bg-muted/20"
        aria-label="New ADM Referral"
      >
        <ColumnHead
          icon={<Send size={14} aria-hidden className="text-blue-500" />}
          title="New ADM Referral"
          action={
            <Button
              type="button"
              variant="outline"
              className="h-6 px-2 text-[11px]"
              onClick={onReferAdm}
            >
              Refer now
            </Button>
          }
        />
        <button
          type="button"
          onClick={onReferAdm}
          aria-label="Start a new ADM referral"
          className="flex min-w-0 flex-1 cursor-pointer flex-col gap-1.5 rounded-lg border bg-white p-3 text-left shadow-sm transition-colors [font-family:var(--font-inter)] hover:border-primary/60 hover:shadow dark:bg-card"
        >
          <span className="flex items-center justify-between gap-2">
            <span className="truncate text-[11px] font-medium text-muted-foreground" title="action/new-adm-referral">
              action/new-adm-referral
            </span>
            <span
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"
              aria-hidden
            >
              <Send size={13} />
            </span>
          </span>
          <span className="truncate text-sm font-semibold leading-snug" title="New ADM Referral">
            New ADM Referral
          </span>
          <span className="text-xs leading-snug text-muted-foreground">
            Refer from an anecdotal record through the ADM track
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
              description="ADM cases start from a filed GCForm-01 record"
              icon={FileText}
            />
          </li>
        </ul>
      </div>

      <div
        className="flex min-w-0 flex-col gap-2 rounded-xl border border-border bg-muted/60 p-2.5 [font-family:var(--font-inter)] dark:bg-muted/20"
        aria-label="My Referrals"
      >
        <ColumnHead
          icon={<Route size={14} aria-hidden className="text-emerald-600 dark:text-emerald-400" />}
          title="My Referrals"
          action={
            <Button asChild variant="outline" className="h-6 px-2 text-[11px]">
              <Link href="/teacher/advisory/referrals">Track</Link>
            </Button>
          }
        />
        <ul className="flex min-w-0 flex-1 flex-col gap-2">
          <li className="flex min-w-0 flex-col">
            <LinkCard
              href="/teacher/advisory/referrals"
              title="My Referrals"
              description="Submitted referrals become ADM cases once endorsed"
              icon={Route}
            />
          </li>
        </ul>
      </div>

      <div
        className="flex min-w-0 flex-col gap-2 rounded-xl border border-border bg-muted/60 p-2.5 [font-family:var(--font-inter)] dark:bg-muted/20"
        aria-label={`ADM Pipeline, ${ADM_STAGE_ENTRIES.length}`}
      >
        <ColumnHead
          icon={<Info size={14} aria-hidden className="text-amber-500" />}
          title="ADM Pipeline"
          count={ADM_STAGE_ENTRIES.length}
        />
        <ul
          className="flex min-w-0 flex-1 flex-row flex-wrap content-center items-center justify-center gap-1.5"
          aria-label="ADM stage legend"
        >
          {ADM_STAGE_ENTRIES.map((e) => (
            <li key={e.key} className="flex">
              <span
                className="inline-flex items-center rounded-md border px-2.5 py-1 text-[10px] font-semibold leading-tight"
                style={{
                  color: e.color,
                  borderColor: `color-mix(in srgb, ${e.color} 40%, transparent)`,
                  backgroundColor: `color-mix(in srgb, ${e.color} 12%, transparent)`,
                }}
                title={e.title}
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

export function AdmEmptyKanban({ onReferAdm }: { onReferAdm?: () => void }) {
  return (
    <section aria-labelledby="adm-empty-board" className="flex min-w-0 flex-col gap-3">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-3">
        <div>
          <h2 id="adm-empty-board" className="m-0 text-[0.9375rem] font-bold tracking-[-0.01em] text-foreground">
            No ADM cases yet
          </h2>
          <p className="m-0 text-[0.8125rem] leading-[1.45] text-muted-foreground">
            Cases you refer through the ADM track will appear here once endorsed. Pick a starting point below.
          </p>
        </div>
        <AdmStarterKanban onReferAdm={onReferAdm} />
      </div>
    </section>
  );
}
