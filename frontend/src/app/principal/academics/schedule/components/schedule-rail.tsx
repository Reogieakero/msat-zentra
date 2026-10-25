"use client";

import * as React from "react";
import Link from "next/link";
import { CheckCircle2, Clock, Inbox, PenLine, type LucideIcon } from "lucide-react";
import { KanbanBoard } from "@/components/ui/kanban-board";
import { Pill } from "@/components/ui/pill";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  SECTION_CARD_STATUS_META,
  sectionCardStatus,
  type SectionCardStatus,
} from "@/components/schedule/SectionScheduleCard";
import { scheduleTone } from "@/lib/labels/status-tone";
import rail from "@/app/principal/overview/components/PrincipalOverviewRail.module.css";
import type { ScheduleSection } from "./schedule-table";
import styles from "./schedule.module.css";

const MENU_PANEL =
  "absolute top-0 right-12 z-50 max-h-[calc(100dvh-6rem)] w-72 overflow-y-auto rounded-xl bg-card text-card-foreground shadow-xl ring-1 ring-border sm:w-80";

type RailKey = "submitted" | "approved" | "draft" | "empty";

interface RailItem {
  key: RailKey;
  icon: LucideIcon;
  title: string;
  hint: string;
  description: string;
  sections: ScheduleSection[];
}

function statusesOf(section: ScheduleSection): SectionCardStatus {
  return sectionCardStatus(section.timetableEntries);
}

function buildItems(sections: ScheduleSection[]): RailItem[] {
  const pick = (status: SectionCardStatus) =>
    sections.filter((section) => statusesOf(section) === status);

  return [
    {
      key: "submitted",
      icon: Clock,
      title: "Awaiting review",
      hint: "Timetables waiting on you",
      description: "Sections whose teachers have submitted a timetable for approval.",
      sections: pick("submitted"),
    },
    {
      key: "approved",
      icon: CheckCircle2,
      title: "Approved",
      hint: "Official timetables",
      description: "Sections running on an approved, official timetable.",
      sections: pick("approved"),
    },
    {
      key: "draft",
      icon: PenLine,
      title: "Draft or returned",
      hint: "Not ready for approval",
      description: "Sections still in draft, or sent back for revision.",
      sections: [...pick("draft"), ...pick("returned")],
    },
    {
      key: "empty",
      icon: Inbox,
      title: "No schedule",
      hint: "Nothing submitted yet",
      description: "Sections that have not started a timetable this term.",
      sections: pick("empty"),
    },
  ];
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

/**
 * Right rail for the schedule board — same amber icon-only rail as the
 * principal overview: hover shows the bucket label, click opens its sections
 * in a flyout kanban panel.
 */
export function ScheduleRail({ sections }: { sections: ScheduleSection[] }) {
  const [openKey, setOpenKey] = React.useState<RailKey | null>(null);
  const railRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!openKey) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Element | null;
      if (
        target?.closest?.('[data-slot="popover-content"], [data-slot="tooltip-content"]')
      ) {
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
  const items = buildItems(sections);

  return (
    <TooltipProvider delayDuration={100}>
      <aside className={rail.rail} style={{ top: "1rem" }} aria-label="Schedule buckets">
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
                      {item.sections.length > 0 ? (
                        <span className={rail.badge} aria-hidden="true">
                          {item.sections.length}
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
                  className={`${MENU_PANEL} ${rail.menu} ${
                    opened ? rail.menuOpen : rail.menuClosed
                  }`}
                >
                  <KanbanBoard
                    title={item.title}
                    icon={
                      <span className={rail.icon} aria-hidden>
                        <Icon size={14} />
                      </span>
                    }
                    count={item.sections.length}
                    description={item.description}
                    className="border-0"
                  >
                    {item.sections.length === 0 ? (
                      <p className={rail.hintText}>Nothing in this bucket.</p>
                    ) : (
                      <ul className={styles.railList}>
                        {item.sections.map((section) => {
                          const meta = SECTION_CARD_STATUS_META[statusesOf(section)];
                          return (
                            <li key={section.id}>
                              <Link
                                href={`/principal/academics/schedule/${section.id}`}
                                className={styles.railRow}
                                onClick={() => setOpenKey(null)}
                              >
                                <span className={styles.railRowName} title={section.name}>
                                  {section.name}
                                </span>
                                <span className={styles.railRowMeta}>
                                  G{section.gradeLevel.replace("G", "")}
                                </span>
                                <Pill tone={scheduleTone(statusesOf(section))}>{meta.label}</Pill>
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    )}
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
