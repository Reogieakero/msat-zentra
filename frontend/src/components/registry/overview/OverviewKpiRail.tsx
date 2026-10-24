"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  FileSignature,
  FileStack,
  GraduationCap,
  ShieldQuestion,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { KanbanBoard } from "@/components/ui/kanban-board";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  fetchRecordKeeperOverview,
  fetchRegistrarOverview,
  type RegistryDesk,
} from "@/services/registry/overview.service";
import menuStyles from "./OverviewKpiRail.module.css";

// Flyout panel — same look as the teacher icon rails: solid surface, shadow
// + ring, smooth open/close. Anchored left of the rail icon.
const MENU_PANEL =
  "absolute top-0 right-12 z-50 max-h-[calc(100dvh-6rem)] w-72 overflow-y-auto rounded-xl bg-card text-card-foreground shadow-xl ring-1 ring-border sm:w-80";

type KpiKey = "finals" | "students" | "adviser" | "sf10";

interface KpiAction {
  key: KpiKey;
  icon: LucideIcon;
  title: string;
  count: number;
  href: string;
  hint: string;
  cta: string;
  description: string;
  accent: string;
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

function GutterTip({ title, hint }: { title: string; hint: string }) {
  return (
    <>
      <span className="font-medium">{title}</span>
      <span className="opacity-60">{hint}</span>
    </>
  );
}

/**
 * Icon-only right rail shared by the registry desk overviews
 * (/record-keeper/overview, /registrar/overview) — one icon per KPI action
 * queue (finals, students, adviser access, SF10 attach), same tooltip +
 * flyout interaction as the teacher attendance gutter. Counts are the real
 * overview KPIs and share OverviewShortcuts' query cache, so the rail and
 * the top KPI board always show the same numbers (and the desk's realtime
 * channel invalidates that key, keeping both live). Links and data are
 * desk-scoped, so the rail mirrors the shell it renders in.
 */
export function OverviewKpiRail({ desk }: { desk: RegistryDesk }) {
  const [openKey, setOpenKey] = React.useState<KpiKey | null>(null);
  const railRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!openKey) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Element | null;
      // Portaled tooltips live outside the rail — interacting with them
      // must not dismiss the open panel.
      if (
        target?.closest?.(
          '[data-slot="popover-content"], [data-slot="tooltip-content"]',
        )
      ) {
        return;
      }
      if (railRef.current && !railRef.current.contains(e.target as Node)) {
        setOpenKey(null);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenKey(null);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [openKey]);

  const toggle = (key: KpiKey) => setOpenKey((prev) => (prev === key ? null : key));
  const panel = (key: KpiKey) =>
    `${MENU_PANEL} ${menuStyles.menu} ${
      openKey === key ? menuStyles.menuOpen : menuStyles.menuClosed
    }`;

  // Same query key as OverviewShortcuts → one shared fetch. The desk's
  // realtime channel invalidates [`${desk}-overview`], so both stay in sync.
  const { data, isPending, isError } = useQuery({
    queryKey: [`${desk}-overview`],
    queryFn: desk === "registrar" ? fetchRegistrarOverview : fetchRecordKeeperOverview,
    staleTime: 30_000,
  });

  const deskLabel = desk === "registrar" ? "registrar" : "record keeper";

  const items: KpiAction[] = [
    {
      key: "finals",
      icon: FileSignature,
      title: "Final Grade Approvals",
      count: data?.lockedFinalsAwaiting ?? 0,
      href: `/${desk}/final-grades`,
      hint: "Ready to view",
      cta: "Open queue",
      description: `Adviser-approved finals ready for the ${deskLabel} queue.`,
      accent: "text-primary",
    },
    {
      key: "students",
      icon: GraduationCap,
      title: "Pending Students",
      count: data?.pendingStudents.length ?? 0,
      href: `/${desk}/accounts`,
      hint: "Awaiting decision",
      cta: "Review accounts",
      description: "Student accounts waiting for LRN verification and approval.",
      accent: "text-blue-500",
    },
    {
      key: "adviser",
      icon: ShieldQuestion,
      title: "Adviser Access",
      count: data?.pendingAdviserAccess ?? 0,
      href: `/${desk}/adviser-access`,
      hint: "Requests to review",
      cta: "Review requests",
      description: "Advisers requesting access to their section records.",
      accent: "text-amber-500",
    },
    {
      key: "sf10",
      icon: FileStack,
      title: "SF10 Records to Attach",
      count: data?.latestAttachments.length ?? 0,
      href: `/${desk}/sf10`,
      hint: "Files in flight",
      cta: "Open records",
      description: "SF10 files in flight that still need to be attached.",
      accent: "text-emerald-600 dark:text-emerald-400",
    },
  ];

  return (
    <TooltipProvider delayDuration={100}>
      <aside className="self-start lg:sticky lg:top-16" aria-label="KPI actions">
        <div
          ref={railRef}
          className="flex flex-row justify-end gap-2 lg:flex-col lg:items-end"
        >
          {items.map((a) => {
            const Icon = a.icon;
            const opened = openKey === a.key;
            const showBadge = !isPending && !isError && a.count > 0;
            const tip = isError
              ? "Could not load"
              : isPending
                ? "Loading…"
                : a.count > 0
                  ? `${a.count} pending`
                  : "All caught up";
            return (
              <div key={a.key} className="relative">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <GutterIconButton
                      label={a.title}
                      expanded={opened}
                      onToggle={() => toggle(a.key)}
                    >
                      <span className={a.accent} aria-hidden>
                        <Icon size={16} />
                      </span>
                      {showBadge ? (
                        <span
                          className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-black"
                          aria-hidden="true"
                        >
                          {a.count}
                        </span>
                      ) : null}
                    </GutterIconButton>
                  </TooltipTrigger>
                  <TooltipContent side="left" sideOffset={10}>
                    <GutterTip title={a.title} hint={tip} />
                  </TooltipContent>
                </Tooltip>
                <div
                  role="dialog"
                  aria-label={a.title}
                  aria-hidden={opened ? undefined : true}
                  className={panel(a.key)}
                >
                  <KanbanBoard
                    title={a.title}
                    icon={
                      <span className={a.accent} aria-hidden>
                        <Icon size={14} />
                      </span>
                    }
                    count={
                      isPending ? (
                        <Skeleton className="h-4 w-6" />
                      ) : isError ? (
                        "—"
                      ) : (
                        a.count
                      )
                    }
                    description={a.description}
                    className="border-0"
                    footer={
                      <div className="flex justify-end gap-1.5 px-1 pb-1">
                        <Button asChild size="sm" className="h-6 px-2 text-xs">
                          <Link
                            href={a.href}
                            aria-label={
                              a.count === 0
                                ? `${a.title}: all caught up — ${a.cta}`
                                : `${a.title}: ${a.count} pending — ${a.cta}`
                            }
                            onClick={() => setOpenKey(null)}
                          >
                            {a.cta}
                            <ArrowRight size={14} aria-hidden />
                          </Link>
                        </Button>
                      </div>
                    }
                  >
                    <p className="flex-1 px-1 text-xs text-muted-foreground">
                      {a.hint}
                    </p>
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
