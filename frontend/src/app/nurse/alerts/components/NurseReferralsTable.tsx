"use client";

import * as React from "react";
import {
  Bell,
  CalendarClock,
  CalendarPlus,
  Check,
  ChevronDown,
  CircleCheck,
  CircleX,
  Eye,
  FileText,
  Flag,
  Hourglass,
  Search,
  Send,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { NURSE_STATUS_LABELS } from "../../overview/components/nurse-overview-data";
import { NurseQueueRowActions } from "../../overview/components/NurseQueueRowActions";
import {
  formatActionTime,
  latestActionOf,
} from "../../referrals/components/nurse-referrals-format";
import {
  type NurseAlertItem,
  type NurseRiskLevel,
} from "./nurse-alerts-data";
import styles from "./nurse-alerts.module.css";

const PAGE_SIZE = 20;

type RiskFilter = "" | NurseRiskLevel | "none";

const RISK_OPTIONS: { value: RiskFilter; label: string }[] = [
  { value: "", label: "All risks" },
  { value: "High", label: "High" },
  { value: "Moderate", label: "Moderate" },
  { value: "Low", label: "Low" },
  { value: "none", label: "No level" },
];

/* Live clock — ticks every 30s; the elapsed readouts render days / hours /
   minutes only, so per-second ticks would just burn renders. */
function useNowTick(): number {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

/* "4d 3h 12m" / "3h 12m" / "12m" / "just now" — days, hours, minutes only,
   never seconds. */
function formatElapsedShort(ms: number): string {
  const totalMinutes = Math.floor(Math.max(0, ms) / 60_000);
  if (totalMinutes < 1) return "just now";
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0 || parts.length === 0) parts.push(`${minutes}m`);
  return parts.join(" ");
}

/* Wall-clock ms of an alert's latest action. Null when unknown — those
   rows sink to the bottom of the sequence. */
function actionTimeOf(alert: NurseAlertItem): number | null {
  const { time } = latestActionOf(alert.row, alert);
  if (!time || time === "—") return null;
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(time) ? `${time}T00:00:00` : time;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : null;
}

/* ms from the given action time to now. Null when unparseable — the cell
   then shows "—". */
function msSince(time: string, now: number): number | null {
  if (!time || time === "—") return null;
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(time) ? `${time}T00:00:00` : time;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.max(0, now - t);
}

function statusVariant(
  status: string
): "warning" | "default" | "secondary" | "outline" | "destructive" | "success" {
  switch (status) {
    case "pending":
      return "warning";
    case "in_progress":
      return "default";
    case "follow_up":
      return "secondary";
    case "info_requested":
      return "outline";
    case "escalated":
      return "destructive";
    case "resolved":
      return "success";
    case "dismissed":
      return "secondary";
    default:
      return "outline";
  }
}

function RiskBadge({ level }: { level: NurseRiskLevel | undefined }) {
  if (!level) return <span className={styles.noRisk}>—</span>;
  const variant =
    level === "High" ? "destructive" : level === "Moderate" ? "warning" : "outline";
  return <Badge variant={variant}>{level}</Badge>;
}

type ActionIcon = React.ComponentType<{ className?: string }>;

/* One icon per latest-action kind, matched by keyword on the action label. */
function actionIconFor(label: string): ActionIcon {
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

/**
 * Every case referred to the nurse (ADM consultations + clinic matters) as
 * one table row: student, case status, live rule-based risk level, latest
 * action (name + elapsed since it ran), and the live countdown from when
 * the case was referred to right now. Read-only — handling happens on the
 * ADM Cases / Clinic Matters pages.
 */
export function NurseReferralsTable({
  alerts,
  riskByStudent,
  onChanged,
}: {
  alerts: NurseAlertItem[];
  riskByStudent: Record<string, NurseRiskLevel>;
  onChanged: () => void;
}) {
  const [query, setQuery] = React.useState("");
  const [risk, setRisk] = React.useState<RiskFilter>("");
  const [page, setPage] = React.useState(1);
  const now = useNowTick();

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = alerts.filter((a) => {
      if (risk !== "") {
        const level = a.studentId ? riskByStudent[a.studentId] : undefined;
        if (risk === "none") {
          if (level !== undefined) return false;
        } else if (level !== risk) {
          return false;
        }
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
    // Sequence by latest action time — most recently acted-on case first,
    // rows with no action time sink to the bottom.
    rows.sort((a, b) => {
      const at = actionTimeOf(a);
      const bt = actionTimeOf(b);
      if (at === null && bt === null) return 0;
      if (at === null) return 1;
      if (bt === null) return -1;
      return bt - at;
    });
    return rows;
  }, [alerts, query, risk, riskByStudent]);

  const clearFilters = React.useCallback(() => {
    setQuery("");
    setRisk("");
    setPage(1);
  }, []);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const start = total === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const end = Math.min(safePage * PAGE_SIZE, total);
  const riskLabel = RISK_OPTIONS.find((o) => o.value === risk)?.label ?? "All risks";
  const hasActiveFilters = query.trim() !== "" || risk !== "";

  return (
    <section aria-label="Referred cases">
      <div className={styles.header}>
        <div className={styles.headerText}>
          <h2 className={styles.sectionTitle}>Referred cases</h2>
          <p className={styles.sectionDesc}>
            Every ADM and clinic matter on your desk — {total} case{total === 1 ? "" : "s"}.
          </p>
        </div>
        {alerts.length > 0 && (
          <div className={styles.headerActions}>
            <div className={styles.searchWrap}>
              <Search className={styles.searchIcon} aria-hidden />
              <Input
                className={styles.search}
                style={{ height: "2rem" }}
                placeholder="Search by student or keyword…"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(1);
                }}
                aria-label="Search referred cases"
              />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  style={{ height: "2rem" }}
                  aria-label={`Filter cases by risk level, currently showing: ${riskLabel}`}
                  className={`${styles.filterBtn} ${risk !== "" ? styles.filterActive : ""}`}
                >
                  {risk === "" ? "Risk" : riskLabel}
                  {risk !== "" && <span className={styles.filterDot} aria-hidden />}
                  <ChevronDown aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className={styles.filterMenu}>
                {RISK_OPTIONS.map((item) => (
                  <DropdownMenuCheckboxItem
                    key={item.label}
                    checked={risk === item.value}
                    onCheckedChange={() => {
                      setRisk(item.value);
                      setPage(1);
                    }}
                  >
                    {item.label}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" className={styles.clearBtn} onClick={clearFilters}>
                <X aria-hidden />
                Show all
              </Button>
            )}
          </div>
        )}
      </div>
      <div className={styles.tableBody}>
        {alerts.length === 0 ? (
          <p className={styles.empty}>No referred cases — nothing needs your attention right now.</p>
        ) : filtered.length === 0 ? (
          <p className={styles.empty}>No cases match your search and filters.</p>
        ) : (
          <div className={styles.tableWrap}>
          <Table aria-label="Cases referred to the nurse">
            <TableHeader>
              <TableRow>
                <TableHead>LRN</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Case status</TableHead>
                <TableHead>Risk</TableHead>
                <TableHead>Latest action</TableHead>
                <TableHead>Time elapsed</TableHead>
                <TableHead>Date referred</TableHead>
                <TableHead>
                  <span className={styles.srOnly}>Row actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageRows.map((alert) => {
                const latest = latestActionOf(alert.row, alert);
                const actionMs = msSince(latest.time, now);
                const riskLevel = alert.studentId
                  ? riskByStudent[alert.studentId]
                  : undefined;
                const ActionIcon = actionIconFor(latest.label);
                // Deep-link to the page where this case lives — the page
                // auto-scrolls to and highlights it. ADM form-ready cases
                // also overlay the filled referral form (form=1); every
                // other row still lands highlighted on its own case.
                const homeBase =
                  alert.row.type === "ADM" ? "/nurse/referrals/adm" : "/nurse/referrals/clinic";
                const seeMoreHref = `${homeBase}?highlight=${alert.row.id}`;
                const viewFormHref =
                  alert.row.type === "ADM" && alert.row.referralReady
                    ? `${seeMoreHref}&form=1`
                    : seeMoreHref;
                return (
                  <TableRow key={alert.key}>
                    <TableCell>
                      <p className={styles.cellMain}>
                        <span className={styles.lrn}>{alert.row.lrn}</span>
                      </p>
                    </TableCell>
                    <TableCell>
                      {alert.row.type === "ADM" ? (
                        <Badge variant="secondary">ADM</Badge>
                      ) : (
                        <Badge variant="outline">Clinic</Badge>
                      )}
                    </TableCell>
<TableCell>
                       {(() => {
                         const doneCount = alert.row.sessions.filter(
                           (s) => s.status === "completed"
                         ).length;
                         const allDone = doneCount > 0 && !alert.row.sessions.some((s) => s.status === "scheduled");
                         const statusLabel = allDone ? "Done" : (NURSE_STATUS_LABELS[alert.row.status] ?? alert.row.status);
                         const statusVar = allDone ? "success" : statusVariant(alert.row.status);
                         return (
                           <>
                             <Badge variant={statusVar}>
                               {statusLabel}
                             </Badge>
                             {doneCount > 0 && !allDone ? (
                               <p className={styles.cellSub}>
                                 {doneCount} session{doneCount === 1 ? "" : "s"} done
                               </p>
                             ) : null}
                           </>
                         );
                       })()}
                     </TableCell>
                    <TableCell>
                      <RiskBadge level={riskLevel} />
                    </TableCell>
                    <TableCell>
                      <p className={styles.actionLabel}>
                        <ActionIcon className={styles.actionIcon} aria-hidden />
                        <span>{latest.label}</span>
                      </p>
                    </TableCell>
                    <TableCell>
                      <p className={styles.cellTime} aria-live="off">
                        {actionMs === null ? "—" : `${formatElapsedShort(actionMs)} ago`}
                      </p>
                    </TableCell>
                    <TableCell>
                      <p className={styles.cellMain}>{formatActionTime(alert.row.date)}</p>
                    </TableCell>
                    <TableCell>
                      <NurseQueueRowActions
                        row={alert.row}
                        onChanged={onChanged}
                        seeMoreHref={seeMoreHref}
                        viewFormHref={viewFormHref}
                        viewOnly
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          </div>
        )}
        <div className={styles.pager}>
          <p className={styles.range}>
            Showing {start}–{end} of {total}
          </p>
          <div className={styles.pagerButtons}>
            <Button
              size="xs"
              variant="outline"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <span className={styles.pageLabel} aria-live="polite">
              Page {safePage} of {totalPages}
            </span>
            <Button
              size="xs"
              variant="outline"
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
