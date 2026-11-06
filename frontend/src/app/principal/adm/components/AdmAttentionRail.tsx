"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { ShieldAlert, TriangleAlert, Users } from "lucide-react";
import { KanbanBoard } from "@/components/ui/kanban-board";
import { Pill } from "@/components/ui/pill";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useTerm } from "@/lib/term/TermContext";
import { fetchRiskBoard } from "@/services/principal/risk.service";
import { InsightCallout } from "@/components/ui/insight-callout";
import { GuidanceAdmNumberText } from "../../../guidance/adm/components/guidance-adm-number-text";
import styles from "../../../guidance/adm/components/guidance-adm.module.css";
import railStyles from "../../overview/components/PrincipalOverviewRail.module.css";

// Flyout panel — same surface + motion as the principal overview rail.
const MENU_PANEL =
  "absolute top-0 right-12 z-50 max-h-[calc(100dvh-6rem)] w-72 overflow-y-auto rounded-xl bg-card text-card-foreground shadow-xl ring-1 ring-border sm:w-80";

/**
 * Icon-only right rail for /principal/adm — carries the "Who needs attention
 * first" queue that used to live inline as a kanban board. Hover shows the
 * queue label; clicking opens the board in a flyout (same interaction as the
 * overview rail).
 */
export function AdmAttentionRail() {
  const { activeTerm, termReady } = useTerm();
  const [open, setOpen] = React.useState(false);
  const railRef = React.useRef<HTMLDivElement>(null);

  const { data, isPending } = useQuery({
    queryKey: [
      "risk-board",
      "adm",
      activeTerm?.termId ?? null,
      activeTerm?.schoolYearId ?? null,
    ],
    queryFn: () => fetchRiskBoard({ admOnly: true }),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    enabled: termReady,
  });

  const sections = React.useMemo(() => {
    const rows = data?.bySection ?? [];
    return [...rows]
      .filter((s) => s.High + s.Moderate > 0)
      .sort((a, b) => b.High - a.High || b.Moderate - a.Moderate)
      .slice(0, 5);
  }, [data]);

  React.useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Element | null;
      if (
        target?.closest?.(
          '[data-slot="popover-content"], [data-slot="tooltip-content"]',
        )
      ) {
        return;
      }
      if (railRef.current && !railRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const summary =
    sections.length === 0
      ? "No section currently carries a high or moderate risk case."
      : `${sections[0].section} carries the most high-risk learners (${sections[0].High}).`;

  const showBadge = !isPending && sections.length > 0;

  return (
    <TooltipProvider delayDuration={100}>
      <aside className={railStyles.rail} aria-label="Who needs attention first">
        <div ref={railRef} className={railStyles.railInner}>
          <div className="relative">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => setOpen((v) => !v)}
                  aria-expanded={open}
                  aria-haspopup="dialog"
                  aria-label={
                    open
                      ? "Close who needs attention first"
                      : "Open who needs attention first"
                  }
                  className={`relative flex h-9 w-9 items-center justify-center rounded-xl border transition-colors ${
                    open
                      ? "cursor-pointer border-amber-500/60 bg-amber-500/10"
                      : "cursor-pointer border-border bg-card hover:border-amber-500/60 hover:bg-amber-500/10"
                  }`}
                >
                  <span className={railStyles.icon} aria-hidden>
                    <ShieldAlert size={16} />
                  </span>
                  {showBadge ? (
                    <span className={railStyles.badge} aria-hidden="true">
                      {sections.length}
                    </span>
                  ) : null}
                </button>
              </TooltipTrigger>
              <TooltipContent side="left" sideOffset={10}>
                <span className={railStyles.tipTitle}>Who needs attention first</span>
                <span className={railStyles.tipHint}>
                  Sections carrying the most high-risk learners
                </span>
              </TooltipContent>
            </Tooltip>
            <div
              role="dialog"
              aria-label="Who needs attention first"
              aria-hidden={open ? undefined : true}
              className={`${MENU_PANEL} ${railStyles.menu} ${
                open ? railStyles.menuOpen : railStyles.menuClosed
              }`}
            >
              <KanbanBoard
                title="Who needs attention first"
                icon={
                  <span className={railStyles.icon} aria-hidden>
                    <ShieldAlert size={14} />
                  </span>
                }
                description="ADM sections carrying the most high-risk learners — open the roster to act."
                className="border-0"
                footer={
                  <div className="mt-auto">
                    <InsightCallout>
                      <GuidanceAdmNumberText>{summary}</GuidanceAdmNumberText>
                    </InsightCallout>
                  </div>
                }
              >
                {isPending ? (
                  <p className={styles.boardEmpty}>Loading sections…</p>
                ) : sections.length === 0 ? (
                  <p className={styles.boardEmpty}>
                    No section currently carries a high or moderate risk case.
                  </p>
                ) : (
                  <ol className={styles.bottleneckList}>
                    {sections.map((s) => (
                      <li key={`${s.section}-${s.gradeLevel}`}>
                        <a
                          className={styles.bottleneckRow}
                          href={`/principal/risk/students?section=${encodeURIComponent(s.section)}`}
                        >
                          <span className={styles.bottleneckMain}>
                            <span className={styles.bottleneckName}>
                              <Pill
                                tone="amber"
                                label="Section"
                                className="max-w-[12rem] truncate"
                              >
                                {s.section}
                              </Pill>
                              <Pill tone="neutral" label="Grade level">
                                {s.gradeLevel}
                              </Pill>
                            </span>
                            <span className="flex flex-wrap items-center gap-1">
                              <Pill tone="red" label="High risk" title="High-risk learners">
                                <ShieldAlert size={11} aria-hidden />
                                {s.High}
                              </Pill>
                              <Pill
                                tone="amber"
                                label="Moderate risk"
                                title="Moderate-risk learners"
                              >
                                <TriangleAlert size={11} aria-hidden />
                                {s.Moderate}
                              </Pill>
                              <Pill
                                tone="neutral"
                                label="Total at risk"
                                title="Total learners at risk"
                              >
                                <Users size={11} aria-hidden />
                                {s.total}
                              </Pill>
                            </span>
                          </span>
                        </a>
                      </li>
                    ))}
                  </ol>
                )}
              </KanbanBoard>
            </div>
          </div>
        </div>
      </aside>
    </TooltipProvider>
  );
}
