"use client";

import * as React from "react";
import {
  Bell,
  BellRing,
  CalendarClock,
  CalendarPlus,
  Check,
  CircleCheck,
  CircleX,
  Clock,
  Eye,
  FileText,
  Flag,
  Hourglass,
  SearchIcon,
  Send,
} from "lucide-react";
import { NurseEmptyState } from "../../components/NurseEmptyCard";
import { Pill, type PillTone } from "@/components/ui/pill";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Skeleton } from "@/components/ui/skeleton";
import { InsightCallout } from "@/components/ui/insight-callout";
import { KanbanBoard } from "@/components/ui/kanban-board";
import { StudentMascot } from "@/components/student-mascot/StudentMascot";
import { NurseActionBadge, waitingElapsed } from "../../overview/components/nurse-action-badge";
import { useNowMs } from "../../overview/components/use-now-ms";
import { NurseQueueRowActions } from "../../overview/components/NurseQueueRowActions";
import { Pagination } from "@/components/shared/pagination";
import type {
  NurseAlertItem,
  NurseRiskLevel,
} from "@/services/nurse/nurse.types";
import styles from "./nurse-alerts.module.css";

type RiskFilter = "" | "High" | "Moderate";

/** Server-side case-type filter — matches the API's ?track= param. */
export type TypeTrack = "adm" | "clinic";

/* Category colour coding shared with the overview / referrals / anecdotal
   pages — one tone per anecdotal category. */
const CATEGORY_TONE: Record<string, PillTone> = {
  behavioral: "amber",
  bullying: "red",
  academic: "blue",
  attendance: "green",
  health: "violet",
};

/* Risk levels offered by the risk tab strip — High / Moderate only (plus the
   reset tab); low-risk cases aren't actionable on this desk. */
const RISK_OPTIONS: { value: RiskFilter; label: string }[] = [
  { value: "", label: "All risks" },
  { value: "High", label: "High" },
  { value: "Moderate", label: "Moderate" },
];

export function statusVariant(
  status: string
): "amber" | "blue" | "green" | "red" | "secondary" | "outline" {
  switch (status) {
    case "pending":
      return "amber";
    case "in_progress":
      return "blue";
    case "follow_up":
      return "blue";
    case "info_requested":
      return "outline";
    case "escalated":
      return "red";
    case "resolved":
      return "green";
    case "dismissed":
      return "red";
    default:
      return "outline";
  }
}

export const ACTION_STATUS_VARIANT: Record<
  string,
  "amber" | "blue" | "green" | "red" | "secondary" | "outline"
> = {
  endorsed: "green",
  done: "green",
  done_session: "green",
  booked: "blue",
  followup: "blue",
  rejected: "red",
  needs_review: "amber",
  escalated: "red",
};

export function RiskBadge({
  level,
  loading = false,
}: {
  level: NurseRiskLevel | undefined;
  loading?: boolean;
}) {
  if (loading && !level)
    return (
      <span className={styles.noRisk} role="status" aria-label="Loading risk level">
        …
      </span>
    );
  if (!level) return <span className={styles.noRisk}>—</span>;

  const tone = level === "High" ? "red" : level === "Moderate" ? "amber" : "green";
  return (
    <Pill tone={tone} label="Risk level">
      {level}
    </Pill>
  );
}

export type ActionIcon = React.ComponentType<{ className?: string }>;

export function actionIconFor(label: string): ActionIcon {
  const text = label.toLowerCase();
  if (text.includes("booked")) return CalendarPlus;
  if (text.includes("moved")) return CalendarClock;
  if (text.includes("done") || text.includes("resolv")) return CircleCheck;
  if (text.includes("cancel") || text.includes("reject")) return CircleX;
  if (text.includes("documentation") || text.includes("filed")) return FileText;
  if (text.includes("follow")) return Flag;
  if (text.includes("accept")) return Check;
  if (
    text.includes("escalat") ||
    text.includes("sent") ||
    text.includes("endors") ||
    text.includes("ready") ||
    text.includes("forward")
  )
    return Send;
  if (text.includes("review") || text.includes("needs")) return Eye;
  if (text.includes("waiting") || text.includes("information")) return Hourglass;
  return Bell;
}

/** Kanban-shaped loading placeholder — the board shell with its rows as
    skeleton bars, so the load and the loaded page read as one surface. */
export function NurseAlertsBoardSkeleton() {
  return (
    <KanbanBoard
      title={<Skeleton className={styles.skelCardTitle} />}
      icon={
        <span className="text-primary" aria-hidden>
          <BellRing size={14} />
        </span>
      }
      ariaLabel="Loading referred cases"
      description={<Skeleton className={styles.skelPanelDesc} />}
      actions={
        <div
          className="flex max-w-[70vw] flex-wrap items-center justify-end gap-2"
          aria-hidden="true"
        >
          <Skeleton className={styles.skelSearch} />
        </div>
      }
      headerCenter={
        <div
          className={`${styles.filterRow} ${styles.filterRowScroll} max-w-[52vw]`}
          aria-hidden="true"
        >
          <Skeleton className={styles.skelTab} />
          <Skeleton className={styles.skelTab} />
          <span className={styles.filterDivider}>|</span>
          <Skeleton className={styles.skelTab} />
          <Skeleton className={styles.skelTab} />
          <Skeleton className={styles.skelTab} />
        </div>
      }
      footer={
        <div className={styles.skelPager} aria-hidden="true">
          <Skeleton className={styles.skelRange} />
          <div className={styles.skelPagerBtns}>
            <Skeleton className={styles.skelBtn} />
            <Skeleton className={styles.skelPageLabel} />
            <Skeleton className={styles.skelBtn} />
          </div>
        </div>
      }
    >
      <ul className={styles.caseList}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <li key={i} className={styles.caseRow} aria-hidden="true">
            <div className={styles.caseInfo}>
              <Skeleton className={styles.skelAvatar} />
              <div className={styles.caseNameBlock}>
                <Skeleton className={styles.skelCaseName} />
                <div className={styles.caseMeta}>
                  <Skeleton className={styles.skelPill} />
                  <Skeleton className={styles.skelPillShort} />
                </div>
              </div>
            </div>
            <div className={styles.cellActions}>
              <Skeleton className={styles.skelPill} />
              <Skeleton className={styles.skelPillShort} />
              <Skeleton className={styles.skelKebab} />
            </div>
          </li>
        ))}
      </ul>
    </KanbanBoard>
  );
}

export function NurseAlertsBoard({
  alerts,
  riskByStudent,
  riskLoading = false,
  onChanged,
  query: controlledQuery,
  onQueryChange,
  track,
  onTrackChange,
  page,
  total: totalProp,
  unfilteredTotal,
  onPageChange,
  serverPaged = false,
}: {
  alerts: NurseAlertItem[];
  riskByStudent: Record<string, NurseRiskLevel>;
  riskLoading?: boolean;
  onChanged: () => void;

  query?: string;
  onQueryChange?: (v: string) => void;

  track: TypeTrack;
  onTrackChange: (track: TypeTrack) => void;

  page?: number;
  total?: number;
  unfilteredTotal?: number;
  onPageChange?: (p: number) => void;
  serverPaged?: boolean;
}) {
  const [internalQuery, setInternalQuery] = React.useState("");
  const [risk, setRisk] = React.useState<RiskFilter>("");
  const nowMs = useNowMs();
  const query = controlledQuery ?? internalQuery;
  const setQuery = onQueryChange ?? setInternalQuery;

  const filtered = React.useMemo(() => {
    // Filter the loaded page instantly as the nurse types (same feel as the
    // teacher desks); the debounced server query then swaps in matches from
    // the rest of the desk.
    const q = query.trim().toLowerCase();
    return alerts.filter((a) => {
      if (risk !== "") {
        const level = a.studentId ? riskByStudent[a.studentId] : undefined;
        if (level !== risk) return false;
      }
      if (
        q !== "" &&
        !`${a.row.student} ${a.row.lrn} ${a.row.section} ${a.row.reason} ${a.row.category}`
          .toLowerCase()
          .includes(q)
      )
        return false;
      return true;
    });
  }, [alerts, query, risk, riskByStudent]);

  const total = serverPaged ? (totalProp ?? filtered.length) : filtered.length;
  const hasActiveFilters = query.trim() !== "" || risk !== "";
  const trackLabel = track === "adm" ? "ADM cases" : "Clinic cases";
  const emptyFiltered = (alerts.length === 0 || filtered.length === 0) && hasActiveFilters;

  return (
    <KanbanBoard
      title="Referred cases"
      icon={
        <span className="text-primary" aria-hidden>
          <BellRing size={14} />
        </span>
      }
      ariaLabel="Referred cases"
      description={`${trackLabel} on your desk — ${total} case${total === 1 ? "" : "s"}${
        serverPaged &&
        unfilteredTotal !== undefined &&
        unfilteredTotal !== total
          ? ` (of ${unfilteredTotal} on your desk)`
          : ""
      }.`}
      headerCenter={
        /* Board-header filter strip (centered like the principal schedule
           selector): ADM/Clinic type tabs (amber), a rule, then the risk pill
           tabs (blue when active). Inline tabs — no dropdown. */
        <div className={`${styles.filterRow} ${styles.filterRowScroll} max-w-[52vw]`}>
          <div
            className={styles.filterGroup}
            role="group"
            aria-label="Filter cases by desk"
          >
            <button
              type="button"
              aria-pressed={track === "adm"}
              onClick={() => onTrackChange("adm")}
              className={styles.filterButton}
            >
              <Pill tone={track === "adm" ? "amber" : "neutral"}>ADM</Pill>
            </button>
            <button
              type="button"
              aria-pressed={track === "clinic"}
              onClick={() => onTrackChange("clinic")}
              className={styles.filterButton}
            >
              <Pill tone={track === "clinic" ? "amber" : "neutral"}>
                Clinic
              </Pill>
            </button>
          </div>
          <span className={styles.filterDivider} aria-hidden>
            |
          </span>
          <div
            className={styles.filterGroup}
            role="group"
            aria-label="Filter cases by risk level"
          >
            {RISK_OPTIONS.map((option) => (
              <button
                key={option.label}
                type="button"
                aria-pressed={risk === option.value}
                onClick={() => {
                  setRisk(option.value);
                }}
                className={styles.filterButton}
              >
                <Pill tone={risk === option.value ? "blue" : "neutral"}>
                  {option.label}
                </Pill>
              </button>
            ))}
          </div>
        </div>
      }
      actions={
        <div className="flex max-w-[70vw] flex-wrap items-center justify-end gap-2">
          <InputGroup className="max-w-40 shrink-0 rounded-[16px]">
            <InputGroupInput
              placeholder="Search cases..."
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
              }}
              aria-label="Search referred cases"
            />
            <InputGroupAddon>
              <SearchIcon />
            </InputGroupAddon>
          </InputGroup>
        </div>
      }
      footer={
        <Pagination
          currentPage={page ?? 1}
          totalItems={serverPaged ? total : filtered.length}
          onPageChange={(p) => onPageChange?.(p)}
        />
      }
    >
      {alerts.length > 0 && filtered.length > 0 ? (
        <ul className={styles.caseList}>
          {filtered.map((alert) => {
            const row = alert.row;
            const level = alert.studentId
              ? riskByStudent[alert.studentId]
              : undefined;
            const wait = waitingElapsed(row.referredAt, nowMs);
            const homeBase =
              row.type === "ADM"
                ? "/nurse/referrals/adm"
                : "/nurse/referrals/clinic";
            const seeMoreHref = `${homeBase}?highlight=${row.id}`;
            const viewFormHref =
              row.type === "ADM" && row.referralReady
                ? `${seeMoreHref}&form=1`
                : seeMoreHref;
            return (
              <li key={alert.key} className={styles.caseRow}>
                <div className={styles.caseInfo}>
                  <StudentMascot
                    name={row.student}
                    seed={row.lrn}
                    character={row.mascot ?? undefined}
                    size={32}
                  />
                  <div className={styles.caseNameBlock}>
                    <p className={styles.cellMain}>{row.student}</p>
                    <div className={styles.caseMeta}>
                      <Pill label="LRN" className="tabular-nums">
                        {row.lrn}
                      </Pill>
                      {row.grade !== "—" && (
                        <Pill label="Grade level">{row.grade}</Pill>
                      )}
                      {row.category !== "—" && (
                        <Pill
                          tone={
                            CATEGORY_TONE[row.category.trim().toLowerCase()] ??
                            "neutral"
                          }
                          label="Category"
                        >
                          {row.category}
                        </Pill>
                      )}
                    </div>
                  </div>
                </div>
                <div className={styles.cellActions}>
                  {row.type === "ADM" ? (
                    <Pill tone="blue" label="Referral type">
                      ADM case
                    </Pill>
                  ) : (
                    <Pill label="Referral type">Clinic</Pill>
                  )}
                  <NurseActionBadge row={row} />
                  <RiskBadge level={level} loading={riskLoading} />
                  {wait !== "—" && (
                    <Pill
                      label={`Waiting since ${row.date}`}
                      className="gap-1 tabular-nums"
                    >
                      <Clock size={11} aria-hidden />
                      {wait}
                    </Pill>
                  )}
                  <NurseQueueRowActions
                    row={row}
                    onChanged={onChanged}
                    seeMoreHref={seeMoreHref}
                    viewFormHref={viewFormHref}
                    viewOnly
                  />
                </div>
              </li>
            );
          })}
        </ul>
      ) : emptyFiltered ? (
        <div className="flex w-full justify-center py-6">
          <InsightCallout role="status" className="w-full max-w-xl text-left">
            <strong>No cases match your search.</strong> Try a different name,
            LRN, or category — or clear the search to see every referred case.
          </InsightCallout>
        </div>
      ) : (
        <NurseEmptyState
          icon={BellRing}
          title="No referred cases"
          hint="No referred cases — nothing needs your attention right now."
        />
      )}
    </KanbanBoard>
  );
}
