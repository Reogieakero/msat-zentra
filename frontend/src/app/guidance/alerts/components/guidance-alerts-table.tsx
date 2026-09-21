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
import type {
  GuidanceReferralItem,
  GuidanceRiskLevel,
} from "../../referrals/components/guidance-referrals-data";
import {
  formatActionTime,
  isEndorsed,
  latestActionOf,
  rowStatusLabel,
} from "../../referrals/components/guidance-referrals-format";
import type { AtRiskStudentItem } from "../../interventions/components/guidance-interventions-data";
import {
  GuidanceAlertsRowActions,
  GuidanceInterventionRowActions,
} from "./GuidanceAlertsRowActions";
import styles from "./guidance-alerts-table.module.css";

const PAGE_SIZE = 20;

/* One table, two pipelines (never mixed upstream): adviser-referred cases
   plus the engine's intervention follow-ups, each row keeping its own
   source shape. */
export type GuidanceAlertRow =
  | { kind: "referral"; referral: GuidanceReferralItem }
  | { kind: "intervention"; item: AtRiskStudentItem };

type TypeFilter = "" | "ADM" | "Counseling" | "Intervention";

const TYPE_OPTIONS: { value: TypeFilter; label: string }[] = [
  { value: "", label: "All types" },
  { value: "ADM", label: "ADM" },
  { value: "Counseling", label: "Counseling" },
  { value: "Intervention", label: "Intervention" },
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

/* Latest action with live session detection first: a booked / finished /
   cancelled intervention session is the freshest thing the reader can act
   on, so it leads; otherwise fall back to the audit-backed trail (status
   changes, notes, escalations). */
function liveLatestActionOf(row: GuidanceReferralItem): { label: string; time: string } {
  if (row.sessions.length > 0) {
    const sorted = [...row.sessions].sort((a, b) => {
      const at = new Date(a.createdAt || a.scheduledAt).getTime();
      const bt = new Date(b.createdAt || b.scheduledAt).getTime();
      if (Number.isNaN(at) && Number.isNaN(bt)) return 0;
      if (Number.isNaN(at)) return 1;
      if (Number.isNaN(bt)) return -1;
      return bt - at;
    });
    const newest = sorted[0];
    if (newest.status === "completed" && row.followUpDate) {
      return { label: "Marked for follow-up", time: row.followUpDate };
    }
    if (newest.status === "completed") {
      return { label: "Session done", time: newest.createdAt || newest.scheduledAt };
    }
    if (newest.status === "cancelled") {
      return { label: "Session cancelled", time: newest.createdAt || newest.scheduledAt };
    }
    return { label: "Session booked", time: newest.createdAt || newest.scheduledAt };
  }
  return latestActionOf(row);
}

/* Latest intervention activity: newest session first, else the moment the
   intervention was opened. Session timing uses execution stamps
   (createdAt = when booked, completedAt = when done) — never the future
   appointment as the action time. */
function interventionLatestAction(item: AtRiskStudentItem): { label: string; time: string } {
  const iv = item.intervention;
  if (iv && iv.sessions.length > 0) {
    const actionTimeOf = (s: { completedAt: string; createdAt: string; scheduledAt: string }) =>
      s.completedAt || s.createdAt || s.scheduledAt;
    const sorted = [...iv.sessions].sort((a, b) => {
      const at = new Date(actionTimeOf(a)).getTime();
      const bt = new Date(actionTimeOf(b)).getTime();
      if (Number.isNaN(at) && Number.isNaN(bt)) return 0;
      if (Number.isNaN(at)) return 1;
      if (Number.isNaN(bt)) return -1;
      return bt - at;
    });
    const newest = sorted[0];
    if (newest.status === "completed") {
      return { label: "Session done", time: newest.completedAt || newest.createdAt || newest.scheduledAt };
    }
    if (newest.status === "cancelled") {
      return { label: "Session cancelled", time: newest.createdAt || newest.scheduledAt };
    }
    return { label: "Session booked", time: newest.createdAt || newest.scheduledAt };
  }
  if (iv?.createdAt) return { label: "Intervention opened", time: iv.createdAt };
  return { label: "Intervention recorded", time: "" };
}

function rowLatest(row: GuidanceAlertRow): { label: string; time: string } {
  return row.kind === "referral"
    ? liveLatestActionOf(row.referral)
    : interventionLatestAction(row.item);
}

/* Wall-clock ms of a row's latest action. Null when unknown — those rows
   sink to the bottom of the sequence. */
function actionTimeOf(row: GuidanceAlertRow): number | null {
  const { time } = rowLatest(row);
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

function referralStatusVariant(
  type: string,
  status: string
): "warning" | "default" | "secondary" | "outline" | "destructive" | "success" {
  if (isEndorsed(type, status)) return "success";
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

function RiskBadge({ level }: { level: GuidanceRiskLevel | undefined }) {
  if (!level) return <span className={styles.noRisk}>—</span>;
  const variant =
    level === "High" ? "destructive" : level === "Moderate" ? "warning" : "outline";
  return <Badge variant={variant}>{level}</Badge>;
}

function asLevel(value: string | undefined): GuidanceRiskLevel | undefined {
  return value === "High" || value === "Moderate" || value === "Low" ? value : undefined;
}

/* One icon per latest-action kind, matched by keyword on the action label.
   Static per-branch JSX (module scope) so no component is created during
   render. */
function ActionGlyph({ label, className }: { label: string; className?: string }) {
  const text = label.toLowerCase();
  const props = { className, "aria-hidden": true } as const;
  if (text.includes("booked")) return <CalendarPlus {...props} />;
  if (text.includes("moved")) return <CalendarClock {...props} />;
  if (text.includes("done") || text.includes("resolv")) return <CircleCheck {...props} />;
  if (text.includes("cancel") || text.includes("reject")) return <CircleX {...props} />;
  if (text.includes("documentation") || text.includes("filed") || text.includes("note"))
    return <FileText {...props} />;
  if (text.includes("follow")) return <Flag {...props} />;
  if (text.includes("accept")) return <Check {...props} />;
  if (
    text.includes("escalat") ||
    text.includes("sent") ||
    text.includes("endors") ||
    text.includes("ready") ||
    text.includes("forward") ||
    text.includes("specialist") ||
    text.includes("adm process") ||
    text.includes("intervention")
  )
    return <Send {...props} />;
  if (text.includes("review") || text.includes("needs")) return <Eye {...props} />;
  if (text.includes("waiting") || text.includes("information")) return <Hourglass {...props} />;
  return <Bell {...props} />;
}

function rowKey(row: GuidanceAlertRow): string {
  return row.kind === "referral" ? `referral:${row.referral.id}` : `intervention:${row.item.studentKey}`;
}

function rowSearchText(row: GuidanceAlertRow): string {
  if (row.kind === "referral") {
    const r = row.referral;
    return `${r.student} ${r.lrn} ${r.section} ${r.reason} ${r.category}`;
  }
  const s = row.item;
  return `${s.student} ${s.lrn} ${s.section} ${s.intervention?.recommendedAction ?? ""} ${s.intervention?.assignee ?? ""}`;
}

function rowRisk(row: GuidanceAlertRow, riskByStudent: Record<string, GuidanceRiskLevel>) {
  if (row.kind === "referral") {
    const id = row.referral.studentId;
    return id ? riskByStudent[id] : undefined;
  }
  return asLevel(row.item.riskLevel);
}

/* Case type for the type filter — adviser-referred tracks plus the
   engine's intervention follow-ups. */
function rowType(row: GuidanceAlertRow): TypeFilter {
  if (row.kind === "referral") {
    return row.referral.type === "ADM" ? "ADM" : "Counseling";
  }
  return "Intervention";
}

/**
 * Every case on the guidance desk as one table row: adviser-referred cases
 * (ADM + counseling tracks) plus the engine's intervention follow-ups.
 * Columns match the nurse referred-cases table: LRN, type, case status,
 * live risk level, latest action (name + elapsed since it ran), and the
 * date it was referred / opened. Handling stays on the case pages; the
 * row menu only views, links out, and books sessions.
 */
export function GuidanceAlertsTable({
  referrals,
  interventions,
  riskByStudent,
}: {
  referrals: GuidanceReferralItem[];
  interventions: AtRiskStudentItem[];
  riskByStudent: Record<string, GuidanceRiskLevel>;
}) {
  const [query, setQuery] = React.useState("");
  const [type, setType] = React.useState<TypeFilter>("");
  const [page, setPage] = React.useState(1);
  const now = useNowTick();

  const rows: GuidanceAlertRow[] = React.useMemo(
    () => [
      ...referrals.map((referral): GuidanceAlertRow => ({ kind: "referral", referral })),
      ...interventions.map((item): GuidanceAlertRow => ({ kind: "intervention", item })),
    ],
    [referrals, interventions]
  );

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const kept = rows.filter((row) => {
      if (type !== "" && rowType(row) !== type) return false;
      if (q !== "" && !rowSearchText(row).toLowerCase().includes(q)) return false;
      return true;
    });
    // Sequence by latest action time — most recently acted-on case first,
    // rows with no action time sink to the bottom.
    kept.sort((a, b) => {
      const at = actionTimeOf(a);
      const bt = actionTimeOf(b);
      if (at === null && bt === null) return 0;
      if (at === null) return 1;
      if (bt === null) return -1;
      return bt - at;
    });
    return kept;
  }, [rows, query, type]);

  const clearFilters = React.useCallback(() => {
    setQuery("");
    setType("");
    setPage(1);
  }, []);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const start = total === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const end = Math.min(safePage * PAGE_SIZE, total);
  const typeLabel = TYPE_OPTIONS.find((o) => o.value === type)?.label ?? "All types";
  const hasActiveFilters = query.trim() !== "" || type !== "";
  const hasRows = rows.length > 0;

  return (
    <section aria-label="Referred cases">
      <div className={styles.header}>
        <div className={styles.headerText}>
          <h2 className={styles.sectionTitle}>Referred cases</h2>
          <p className={styles.sectionDesc}>
            Every ADM, counseling, and intervention case on your desk — {total} case
            {total === 1 ? "" : "s"}.
          </p>
        </div>
        {hasRows && (
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
                  aria-label={`Filter cases by type, currently showing: ${typeLabel}`}
                  className={`${styles.filterBtn} ${type !== "" ? styles.filterActive : ""}`}
                >
                  {type === "" ? "Type" : typeLabel}
                  {type !== "" && <span className={styles.filterDot} aria-hidden />}
                  <ChevronDown aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className={styles.filterMenu}>
                {TYPE_OPTIONS.map((item) => (
                  <DropdownMenuCheckboxItem
                    key={item.label}
                    checked={type === item.value}
                    onCheckedChange={() => {
                      setType(item.value);
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
        {!hasRows ? (
          <p className={styles.empty}>No referred cases — nothing needs your attention right now.</p>
        ) : filtered.length === 0 ? (
          <p className={styles.empty}>No cases match your search and filters.</p>
        ) : (
          <div className={styles.tableWrap}>
            <Table aria-label="Cases on the guidance desk">
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
                {pageRows.map((row) => (
                  <CaseTableRow
                    key={rowKey(row)}
                    row={row}
                    riskLevel={rowRisk(row, riskByStudent)}
                    now={now}
                  />
                ))}
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

function CaseTableRow({
  row,
  riskLevel,
  now,
}: {
  row: GuidanceAlertRow;
  riskLevel: GuidanceRiskLevel | undefined;
  now: number;
}) {
  const latest = rowLatest(row);
  const actionMs = latest.time ? msSince(latest.time, now) : null;

  if (row.kind === "intervention") {
    const item = row.item;
    const iv = item.intervention;
    const outcome = iv?.outcomeStatus ?? "ongoing";
    const statusVar =
      outcome === "ongoing" ? "default" : outcome === "resolved" ? "success" : "destructive";
    const statusText =
      outcome === "ongoing" ? "Ongoing" : outcome === "resolved" ? "Resolved" : "Unresolved";
    const doneCount = iv?.completedSessions ?? 0;
    const dateText = iv?.createdAt ? formatActionTime(iv.createdAt) : "—";
    return (
      <TableRow>
        <TableCell>
          <p className={styles.cellMain}>
            <span className={styles.lrn}>{item.lrn}</span>
          </p>
          <p className={styles.cellSub}>
            {item.student} · {item.section}
          </p>
        </TableCell>
        <TableCell>
          <Badge variant="default">Intervention</Badge>
        </TableCell>
        <TableCell>
          <Badge variant={statusVar}>{statusText}</Badge>
          {doneCount > 0 && outcome === "ongoing" ? (
            <p className={styles.cellSub}>
              {doneCount} session{doneCount === 1 ? "" : "s"} done
            </p>
          ) : null}
        </TableCell>
        <TableCell>
          <RiskBadge level={riskLevel} />
        </TableCell>
        <TableCell>
          <p className={styles.actionLabel}>
            <ActionGlyph label={latest.label} className={styles.actionIcon} />
            <span>{latest.label}</span>
          </p>
        </TableCell>
        <TableCell>
          <p className={styles.cellTime} aria-live="off">
            {actionMs === null ? "—" : `${formatElapsedShort(actionMs)} ago`}
          </p>
        </TableCell>
        <TableCell>
          <p className={styles.cellMain}>{dateText}</p>
        </TableCell>
        <TableCell>
          <GuidanceInterventionRowActions item={item} />
        </TableCell>
      </TableRow>
    );
  }

  const r = row.referral;
  const doneCount = r.sessions.filter((s) => s.status === "completed").length;
  const allDone = doneCount > 0 && !r.sessions.some((s) => s.status === "scheduled");
  const statusText = allDone ? "Done" : rowStatusLabel(r.type, r.status);
  const statusVar = allDone ? "success" : referralStatusVariant(r.type, r.status);
  return (
    <TableRow>
      <TableCell>
        <p className={styles.cellMain}>
          <span className={styles.lrn}>{r.lrn}</span>
        </p>
        <p className={styles.cellSub}>
          {r.student} · {r.section}
        </p>
      </TableCell>
      <TableCell>
        {r.type === "ADM" ? (
          <Badge variant="secondary">ADM</Badge>
        ) : (
          <Badge variant="outline">Counseling</Badge>
        )}
      </TableCell>
      <TableCell>
        <Badge variant={statusVar}>{statusText}</Badge>
        {doneCount > 0 && !allDone ? (
          <p className={styles.cellSub}>
            {doneCount} session{doneCount === 1 ? "" : "s"} done
          </p>
        ) : null}
      </TableCell>
      <TableCell>
        <RiskBadge level={riskLevel} />
      </TableCell>
        <TableCell>
          <p className={styles.actionLabel}>
            <ActionGlyph label={latest.label} className={styles.actionIcon} />
            <span>{latest.label}</span>
          </p>
        </TableCell>
      <TableCell>
        <p className={styles.cellTime} aria-live="off">
          {actionMs === null ? "—" : `${formatElapsedShort(actionMs)} ago`}
        </p>
      </TableCell>
      <TableCell>
        <p className={styles.cellMain}>{formatActionTime(r.date)}</p>
      </TableCell>
        <TableCell>
          <GuidanceAlertsRowActions row={r} />
        </TableCell>
    </TableRow>
  );
}
