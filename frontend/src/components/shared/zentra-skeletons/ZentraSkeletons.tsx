import type { CSSProperties, ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { KanbanBoard } from "@/components/ui/kanban-board";
import rowListStyles from "@/components/ui/row-list.module.css";
import paginationStyles from "@/components/shared/pagination/ZentraPagination.module.css";
import styles from "./ZentraSkeletons.module.css";

/* ---------------------------------------------------------------------------
   Generic, shareable skeleton kit.

   Rules of the kit (so placeholders can't drift from the real UI):
   - Every skeleton reuses the SAME component shell or CSS module the real
     content uses where one exists (KanbanBoard, row-list.module.css,
     ZentraPagination.module.css). Only the leaf placeholders are invented.
   - Animation is always the shared <Skeleton/> (`animate-pulse bg-muted`).
   - All skeletons are aria-hidden (they carry no semantics).
   Any page (teacher/registrar/record-keeper/nurse/…) can compose these.
--------------------------------------------------------------------------- */

/* ------------------------------- page header ------------------------------ */

export function ZentraPageHeaderSkeleton({
  withActions = false,
  actionCount = 1,
  variant = "default",
}: {
  withActions?: boolean;
  actionCount?: number;
  /** `default` = bordered ZentraPageHeader; `plain` = bare h1+p (text-2xl/text-sm). */
  variant?: "default" | "plain";
}) {
  const plain = variant === "plain";
  return (
    <div className={plain ? styles.pageHeaderPlain : styles.pageHeader} aria-hidden="true">
      <div className={plain ? styles.pageHeaderTextLarge : styles.pageHeaderText}>
        <Skeleton className={plain ? styles.pageHeaderTitleLarge : styles.pageHeaderTitle} />
        <Skeleton className={plain ? styles.pageHeaderSubtitleLarge : styles.pageHeaderSubtitle} />
      </div>
      {withActions ? (
        <div className={styles.pageHeaderActions}>
          {Array.from({ length: actionCount }).map((_, i) => (
            <Skeleton key={i} className={styles.pageHeaderAction} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------ kanban board ------------------------------ */
/* Renders the REAL <KanbanBoard> shell so section/inner-card/header geometry
   (p-2.5, gap-2, rounded-xl, -mx-2.5 header border) is always identical. */
export function KanbanBoardSkeleton({
  titleWidth = "9rem",
  rows = 4,
  showCount = false,
  showDescription = false,
  actions,
  headerCenter,
  rowsClassName,
  children,
  footer,
  className,
  style,
}: {
  titleWidth?: string;
  rows?: number;
  showCount?: boolean;
  showDescription?: boolean;
  /** Reserve the header's right-side slot (e.g. a "View all" link). */
  actions?: ReactNode;
  /** Reserve the header's centered slot (e.g. a filter/view switcher). */
  headerCenter?: ReactNode;
  rowsClassName?: string;
  children?: ReactNode;
  footer?: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <KanbanBoard
      title={<Skeleton className={styles.boardTitle} style={{ width: titleWidth }} />}
      count={showCount ? <Skeleton className={styles.boardCount} /> : undefined}
      actions={actions}
      headerCenter={headerCenter}
      description={showDescription ? <Skeleton className={styles.boardDesc} /> : undefined}
      footer={footer}
      className={className}
      style={style}
    >
      {children ??
        Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className={`${styles.boardRow}${rowsClassName ? ` ${rowsClassName}` : ""}`} />
        ))}
    </KanbanBoard>
  );
}

/* -------------------------------- icon rail ------------------------------- */

export function IconRailSkeleton({
  count = 5,
  className,
  children,
}: {
  count?: number;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <aside className={`${styles.rail}${className ? ` ${className}` : ""}`} aria-hidden="true">
      {children ??
        Array.from({ length: count }).map((_, i) => <Skeleton key={i} className={styles.railBtn} />)}
    </aside>
  );
}

/* --------------------------------- row list ------------------------------- */
/* Reuses the real row-list.module.css grid so columns, gutters, dividers and
   responsive breakpoints are guaranteed to match a loaded <RowList/>. */
export function RowListSkeleton({
  rows = 8,
  hasLead = false,
  bleed = true,
  gutter,
  withAvatar = true,
  withIdPill = true,
  withDatePill = false,
  withMetaAvatar,
  withActions = false,
  metaPills = 2,
}: {
  rows?: number;
  hasLead?: boolean;
  bleed?: boolean;
  /** Container gutter the bleed cancels (default 1.125rem). */
  gutter?: string;
  withAvatar?: boolean;
  withIdPill?: boolean;
  withDatePill?: boolean;
  /** Trailing initials circle (defaults to `withAvatar`). Set false when the
      real rows carry a leading mascot and suppress the trailing avatar. */
  withMetaAvatar?: boolean;
  /** Reserve a trailing row action (icon kebab/eye). */
  withActions?: boolean;
  metaPills?: number;
}) {
  const showMetaAvatar = withMetaAvatar ?? withAvatar;
  return (
    <ul
      className={`${rowListStyles.list}${bleed ? ` ${rowListStyles.listBleed}` : ""}${
        hasLead ? ` ${rowListStyles.listLead}` : ""
      }`}
      style={gutter ? ({ "--row-list-gutter": gutter } as CSSProperties) : undefined}
      aria-hidden="true"
    >
      {Array.from({ length: rows }).map((_, i) => (
        <li key={i} className={`${rowListStyles.row}${hasLead ? ` ${rowListStyles.rowLead}` : ""}`}>
          {hasLead ? <Skeleton className={styles.rowLeadPill} /> : null}
          <Skeleton className={styles.rowStatus} />
          <span className={rowListStyles.sep}>|</span>
          <span className={rowListStyles.titleCell}>
            {withAvatar ? <Skeleton className={styles.rowAvatar} /> : null}
            <Skeleton className={styles.rowTitle} />
            {withIdPill ? <Skeleton className={styles.rowIdPill} /> : null}
          </span>
          <span className={rowListStyles.metaCell}>
            {Array.from({ length: metaPills }).map((_, m) => (
              <Skeleton key={m} className={styles.rowMetaPill} />
            ))}
            {withDatePill ? <Skeleton className={styles.rowDatePill} /> : null}
            {showMetaAvatar ? <Skeleton className={styles.rowMetaAvatar} /> : null}
            {withActions ? <Skeleton className={styles.rowAction} /> : null}
          </span>
        </li>
      ))}
    </ul>
  );
}

/* -------------------------------- pagination ------------------------------ */
/* Mirrors the real <ZentraPagination/> footer (two info spans + icon prev/next
   + numbered page list) using its own CSS module. */
export function ZentraPaginationSkeleton({ pages = 3 }: { pages?: number }) {
  return (
    <nav className={paginationStyles.footer} aria-hidden="true">
      <Skeleton className={paginationStyles.footerInfo} style={{ height: "0.75rem", width: "7rem" }} />
      <Skeleton className={paginationStyles.footerInfo} style={{ height: "0.75rem", width: "5rem" }} />
      <div className={paginationStyles.footerActions}>
        <Skeleton className={styles.pagerBtn} style={{ height: "2rem", width: "2rem" }} />
        <ul className={paginationStyles.pageList}>
          {Array.from({ length: pages }).map((_, i) => (
            <li key={i}>
              <Skeleton className={styles.pagerBtn} style={{ height: "2rem", width: "2rem" }} />
            </li>
          ))}
        </ul>
        <Skeleton className={styles.pagerBtn} style={{ height: "2rem", width: "2rem" }} />
      </div>
    </nav>
  );
}

/* --------------------------------- tokens --------------------------------- */

/** Reserves the width/position of a real date string (e.g. "Mon, 19 Oct 2026"). */
export function DatePillSkeleton({ className }: { className?: string }) {
  return <Skeleton className={`${styles.datePill}${className ? ` ${className}` : ""}`} />;
}

/** Reserves the width/position of a real LRN pill. */
export function LrnPillSkeleton({ className }: { className?: string }) {
  return <Skeleton className={`${styles.lrnPill}${className ? ` ${className}` : ""}`} />;
}

/* ---------------------------------- cards --------------------------------- */

export function ZentraDashboardCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={`${styles.card}${className ? ` ${className}` : ""}`} aria-hidden="true">
      <Skeleton className={styles.cardLabel} />
      <Skeleton className={styles.cardValue} />
      <Skeleton className={styles.cardHint} />
    </div>
  );
}

/* ------------------------------- filter bar ------------------------------- */

export function ZentraFilterBarSkeleton({ selects = 2 }: { selects?: number }) {
  return (
    <div className={styles.filterBar} aria-hidden="true">
      <Skeleton className={styles.search} />
      {Array.from({ length: selects }).map((_, i) => (
        <Skeleton key={i} className={styles.select} />
      ))}
      <Skeleton className={styles.filterBtn} />
    </div>
  );
}

/* ---------------------------------- table --------------------------------- */
/* Prefer <KanbanBoardSkeleton rows={<RowListSkeleton/>}/> for real tables;
   this remains for genuine <table> layouts. */
export function ZentraTableSkeleton({
  rows = 8,
  columns = 4,
  withPager = true,
}: {
  rows?: number;
  columns?: number;
  withPager?: boolean;
}) {
  return (
    <div className={styles.tableWrap} aria-hidden="true">
      <div className={styles.tableHead}>
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} className={styles.cell} />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className={styles.tableRow}>
          <div className={styles.cellMain}>
            <Skeleton className={styles.cellName} />
            <Skeleton className={styles.cellSub} />
          </div>
          {Array.from({ length: Math.max(1, columns - 1) }).map((_, c) => (
            <Skeleton key={c} className={c === 0 ? styles.cellBadge : styles.cell} />
          ))}
        </div>
      ))}
      {withPager ? <ZentraPaginationSkeleton /> : null}
    </div>
  );
}

/* --------------------------------- chart ---------------------------------- */

export function ZentraChartSkeleton({
  compact = false,
  withLegend = true,
}: {
  compact?: boolean;
  withLegend?: boolean;
}) {
  return (
    <div className={styles.chart} aria-hidden="true">
      <Skeleton className={styles.chartTitle} />
      <Skeleton className={compact ? styles.chartBodySm : styles.chartBody} />
      {withLegend ? (
        <div className={styles.legend}>
          <Skeleton className={styles.legendChip} />
          <Skeleton className={styles.legendChip} />
          <Skeleton className={styles.legendChip} />
        </div>
      ) : null}
    </div>
  );
}

/* --------------------------------- modal ---------------------------------- */

export function ZentraModalSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div aria-hidden="true">
      <div className={styles.modalBody}>
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className={styles.modalField} />
        ))}
      </div>
      <div className={styles.modalFooter}>
        <Skeleton className={styles.pagerBtn} />
        <Skeleton className={styles.pagerBtn} />
      </div>
    </div>
  );
}
