"use client";

import * as React from "react";
import {
  Check,
  ClipboardCheck,
  Info,
  Loader2,
  Pencil,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { KanbanBoard } from "@/components/ui/kanban-board";
import { Pill } from "@/components/ui/pill";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { scheduleTone } from "@/lib/labels/status-tone";
import rail from "@/app/principal/overview/components/PrincipalOverviewRail.module.css";
import type { Submission } from "./use-principal-schedule-section";
import styles from "./section-rail.module.css";

const MENU_PANEL =
  "absolute top-0 right-12 z-50 max-h-[calc(100dvh-6rem)] w-72 overflow-y-auto rounded-xl bg-card text-card-foreground shadow-xl ring-1 ring-border sm:w-80";

type RailKey = "adviser" | "status" | "review" | "legend";

interface StatusMeta {
  title: string;
  message: string;
  from: string;
  to: string;
  chip: string;
  icon: string;
  Icon: React.ComponentType<{ size?: number | string; className?: string }>;
}

interface SectionRailProps {
  submission: Submission;
  submittedCount: number;
  statusMeta: StatusMeta;
  note: string;
  onOpenReview: () => void;
  onReview: (decision: "approve" | "reject") => void;
  rejecting: boolean;
  approving: boolean;
  reviewPending: boolean;
}

function GutterIconButton({
  label,
  expanded,
  onToggle,
  children,
  ref,
  ...triggerProps
}: {
  label: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  ref?: React.Ref<HTMLButtonElement>;
} & Omit<React.ComponentPropsWithoutRef<"button">, "onClick" | "aria-label">) {
  return (
    <button
      ref={ref}
      type="button"
      {...triggerProps}
      onClick={onToggle}
      aria-expanded={expanded}
      aria-haspopup="dialog"
      aria-label={expanded ? `Close ${label}` : `Open ${label}`}
      className={`relative flex h-9 w-9 items-center justify-center rounded-xl border transition-colors ${
        expanded
          ? "cursor-pointer border-amber-500/60 bg-amber-500/10"
          : "cursor-pointer border-border bg-card hover:border-amber-500/60 hover:bg-amber-500/10"
      }`}
    >
      {children}
    </button>
  );
}

const LEGEND: { label: string; key: "draft" | "submitted" | "approved"; Icon: LucideIcon }[] = [
  { label: "Draft", key: "draft", Icon: Pencil },
  { label: "Submitted", key: "submitted", Icon: ClipboardCheck },
  { label: "Approved", key: "approved", Icon: Check },
];

/**
 * Right rail for a section's timetable review — amber icon-only rail, same
 * hover tooltip + flyout kanban panels as the principal overview.
 */
export function SectionRail({
  submission,
  submittedCount,
  statusMeta,
  note,
  onOpenReview,
  onReview,
  rejecting,
  approving,
  reviewPending,
}: SectionRailProps) {
  const [openKey, setOpenKey] = React.useState<RailKey | null>(null);
  const railRef = React.useRef<HTMLDivElement>(null);
  const StatusIcon = statusMeta.Icon;
  const statusKey = statusMeta.title.toLowerCase();

  React.useEffect(() => {
    if (!openKey) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Element | null;
      if (target?.closest?.('[data-slot="popover-content"], [data-slot="tooltip-content"]')) {
        return;
      }
      if (railRef.current && !railRef.current.contains(event.target as Node)) {
        setOpenKey(null);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenKey(null);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [openKey]);

  const toggle = (key: RailKey) => setOpenKey((prev) => (prev === key ? null : key));
  const panel = (key: RailKey) =>
    `${MENU_PANEL} ${rail.menu} ${openKey === key ? rail.menuOpen : rail.menuClosed}`;

  const items: {
    key: RailKey;
    icon: StatusMeta["Icon"];
    title: string;
    hint: string;
    count?: number;
    body: React.ReactNode;
  }[] = [
    {
      key: "adviser",
      icon: UserRound,
      title: "Adviser",
      hint: "Section adviser",
      body: (
        <p className={styles.row}>
          <span className={styles.label}>Adviser</span>
          {submission.adviser?.fullName ? (
            <Pill tone="amber" className="max-w-[11rem] overflow-hidden">
              {submission.adviser.fullName}
            </Pill>
          ) : (
            <Pill tone="neutral">No adviser</Pill>
          )}
        </p>
      ),
    },
    {
      key: "status",
      icon: StatusIcon,
      title: "Status",
      hint: "Review state of this timetable",
      body: (
        <div className={styles.stack}>
          <p className={styles.row}>
            <span className={styles.label}>Status</span>
            <Pill tone={scheduleTone(statusKey)}>{statusMeta.title}</Pill>
          </p>
          <p className={styles.row}>
            <span className={styles.label}>Slots</span>
            <span className={styles.value}>{submission.timetableEntries.length}</span>
          </p>
          <p className={styles.row}>
            <span className={styles.label}>Awaiting review</span>
            <span className={styles.value}>{submittedCount}</span>
          </p>
          <p className={styles.hintText}>{statusMeta.message}</p>
        </div>
      ),
    },
    {
      key: "review",
      icon: ClipboardCheck,
      title: "Review",
      hint: "Approve or send back with a note",
      count: submittedCount,
      body:
        submittedCount > 0 ? (
          <div className={styles.stack}>
            <button
              type="button"
              onClick={onOpenReview}
              aria-haspopup="dialog"
              className={`flex min-h-8 w-full items-center rounded-md border border-input bg-transparent px-2 py-1 text-xs shadow-xs transition-colors hover:border-primary ${
                note ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              <span className="truncate">
                {note ? note : "Revision note (required to send back)…"}
              </span>
            </button>
            <div className="flex gap-2">
              <Button
                variant="destructive"
                size="sm"
                onClick={() => onReview("reject")}
                disabled={reviewPending}
                aria-busy={rejecting || undefined}
                className="h-6 flex-1 px-2 text-xs"
              >
                {rejecting ? <Loader2 size={12} className="animate-spin" aria-hidden /> : null}
                <span aria-live="polite">Reject</span>
              </Button>
              <Button
                size="sm"
                onClick={() => onReview("approve")}
                disabled={reviewPending}
                aria-busy={approving || undefined}
                className="h-6 flex-1 px-2 text-xs"
              >
                {approving ? <Loader2 size={12} className="animate-spin" aria-hidden /> : null}
                <span aria-live="polite">Approve</span>
              </Button>
            </div>
          </div>
        ) : (
          <p className={styles.hintText}>Nothing submitted for review yet.</p>
        ),
    },
    {
      key: "legend",
      icon: Info,
      title: "Legend",
      hint: "What each slot status means",
      body: (
        <ul className={styles.legendList}>
          {LEGEND.map((row) => {
            const Icon = row.Icon;
            return (
              <li key={row.key} className={styles.legendRow}>
                <Pill tone={scheduleTone(row.key)}>
                  <Icon size={11} aria-hidden />
                  {row.label}
                </Pill>
              </li>
            );
          })}
        </ul>
      ),
    },
  ];

  return (
    <TooltipProvider delayDuration={100}>
      <aside className={rail.rail} style={{ top: "1rem" }} aria-label="Section review">
        <div ref={railRef} className={rail.railInner}>
          {items.map((item) => {
            const Icon = item.icon;
            const opened = openKey === item.key;
            return (
              <div key={item.key} className="relative">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <GutterIconButton
                      label={item.title}
                      expanded={opened}
                      onToggle={() => toggle(item.key)}
                    >
                      <span className={rail.icon} aria-hidden>
                        <Icon size={16} />
                      </span>
                      {item.count ? (
                        <span className={rail.badge} aria-hidden="true">
                          {item.count}
                        </span>
                      ) : null}
                    </GutterIconButton>
                  </TooltipTrigger>
                  <TooltipContent side="left" sideOffset={10}>
                    <span className={rail.tipTitle}>{item.title}</span>
                    <span className={rail.tipHint}>{item.hint}</span>
                  </TooltipContent>
                </Tooltip>
                <div
                  role="dialog"
                  aria-label={item.title}
                  aria-hidden={opened ? undefined : true}
                  className={panel(item.key)}
                  onClick={(event) => {
                    // Action buttons hand off to the dialog / mutation — close
                    // the flyout so the rail does not sit over the modal.
                    if (!(event.target as Element).closest("button")) return;
                    setOpenKey(null);
                  }}
                >
                  <KanbanBoard
                    title={item.title}
                    icon={
                      <span className={rail.icon} aria-hidden>
                        <Icon size={14} />
                      </span>
                    }
                    count={item.count}
                    description={item.hint}
                    className="border-0"
                  >
                    {item.body}
                  </KanbanBoard>
                </div>
              </div>
            );
          })}
        </div>
      </aside>
    </TooltipProvider>
  );
}
