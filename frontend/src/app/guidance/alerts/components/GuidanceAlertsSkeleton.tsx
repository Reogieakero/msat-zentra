"use client";

import { KanbanBoard } from "@/components/ui/kanban-board";
import { Skeleton } from "@/components/ui/skeleton";
import { ZentraPaginationSkeleton } from "@/components/shared/zentra-skeletons/ZentraSkeletons";
import pageStyles from "./guidance-alerts.module.css";
import rowStyles from "./guidance-alerts-table.module.css";

/**
 * Loading shell for /guidance/alerts. It renders the real board chrome —
 * KanbanBoard header (title, description, centered type/risk tabs, search),
 * the shared pagination footer, the kanban case-row grid and the icon rail —
 * so nothing moves when the merged desk data lands.
 */

const ROWS = 8;
/** Same pill labels as the live tabs: All types · ADM · Counseling · Intervention. */
const TYPE_PILL_WIDTHS = ["4.4rem", "2.1rem", "4.9rem", "5.6rem"];
/** All risks · High risk · Moderate risk. */
const RISK_PILL_WIDTHS = ["4.2rem", "4.3rem", "5.7rem"];

function HeaderTabsSkeleton() {
  return (
    <div className={rowStyles.headerTabs} aria-hidden="true">
      {TYPE_PILL_WIDTHS.map((width) => (
        <Skeleton key={width} className="h-5 rounded-md" style={{ width }} />
      ))}
      <span className={rowStyles.tabDivider} />
      {RISK_PILL_WIDTHS.map((width) => (
        <Skeleton key={width} className="h-5 rounded-md" style={{ width }} />
      ))}
    </div>
  );
}

/** One placeholder case row on the real `.caseRow` grid tracks. */
function CaseRowSkeleton() {
  return (
    <li className={rowStyles.caseRow}>
      <div className={rowStyles.caseStudent}>
        <Skeleton className={rowStyles.skelTypePill} />
        <span className={rowStyles.caseSeparator} aria-hidden="true">
          |
        </span>
        <Skeleton className="size-8 shrink-0 rounded-full" />
        <div className={rowStyles.caseIdentity}>
          <Skeleton className="h-[0.8125rem] w-32 max-w-full" />
          <p className={rowStyles.cellSub}>
            <Skeleton className="h-[1.125rem] w-20 rounded-md" />
            <Skeleton className="h-[1.125rem] w-16 rounded-md" />
          </p>
        </div>
      </div>
      <div className={rowStyles.caseStatusCell}>
        <Skeleton className={rowStyles.skelSplitPill} />
      </div>
      <div className={rowStyles.caseTimeCell}>
        <Skeleton className={rowStyles.skelTimePill} />
      </div>
      <div className={rowStyles.caseActions}>
        <Skeleton className="size-6 rounded-md" />
        <Skeleton className={rowStyles.skelBookPill} />
      </div>
    </li>
  );
}

export function GuidanceAlertsSkeleton() {
  return (
    <section className={pageStyles.page} aria-busy="true" aria-label="Loading referred cases">
      <div className={pageStyles.body}>
        <div className={pageStyles.mainCol}>
          <KanbanBoard
            title={
              <span className="inline-flex min-w-0 items-center gap-1.5">
                <Skeleton className="size-3.5 rounded" />
                <Skeleton className="h-3.5 w-28" />
              </span>
            }
            description={<Skeleton className="h-3 w-[19rem] max-w-full" />}
            headerCenter={<HeaderTabsSkeleton />}
            actions={
              <div className={rowStyles.headerControls}>
                <div className={rowStyles.searchWrap}>
                  <Skeleton className="h-8 w-full" style={{ borderRadius: 16 }} />
                </div>
              </div>
            }
            footer={<ZentraPaginationSkeleton />}
          >
            <ul className={rowStyles.caseList} aria-hidden="true">
              {Array.from({ length: ROWS }, (_, i) => (
                <CaseRowSkeleton key={i} />
              ))}
            </ul>
          </KanbanBoard>
        </div>

        <aside className="self-start lg:sticky lg:top-16">
          <div className={pageStyles.skelRail} aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className={pageStyles.skelRailIcon} />
            ))}
          </div>
        </aside>
      </div>
    </section>
  );
}
