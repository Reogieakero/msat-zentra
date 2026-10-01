"use client";

import * as React from "react";
import { Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import styles from "./adm-queue.module.css";

/* Badge color language for queue statuses — color-coded (amber/blue/green/
   red) plus the legacy neutrals guidance still passes. */
export type AdmQueueStatusVariant =
  | "amber"
  | "blue"
  | "green"
  | "red"
  | "secondary"
  | "outline"
  | "warning"
  | "default"
  | "destructive"
  | "success";

export type AdmQueueRisk = "High" | "Moderate" | "Low";

/* One display-ready row. Each role maps its own case shape onto this —
   the table itself never knows about guidance or nurse rows. */
export interface AdmQueueRowVM {
  id: string;
  lrn: string;
  student: string;
  section: string;
  searchText: string;
  statusLabel: string;
  statusVariant: AdmQueueStatusVariant;
  riskLevel: AdmQueueRisk | undefined;
  latestLabel: string;
  LatestIcon: React.ComponentType<{ className?: string }>;
  /* ISO time of the latest action for the elapsed clock ("—"/null
     renders "—"). */
  actionTime: string | null;
  dateReferred: string;
}

/* Live clock — ticks every 30s; elapsed readouts render days / hours /
   minutes only, so per-second ticks would just burn renders. */
function useNowTick(): number {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

/* "4d 3h 12m" / "3h 12m" / "12m" / "just now" — days, hours, minutes
   only, never seconds. */
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

/* ms from the given action time to now. Null when unparseable — the
   cell then shows "—". */
function msSince(time: string | null, now: number): number | null {
  if (!time || time === "—") return null;
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(time) ? `${time}T00:00:00` : time;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.max(0, now - t);
}

function RiskBadge({ level, loading = false }: { level: AdmQueueRisk | undefined; loading?: boolean }) {
  if (loading && !level)
    return (
      <span className={styles.noRisk} role="status" aria-label="Loading risk level">
        …
      </span>
    );
  if (!level) return <span className={styles.noRisk}>—</span>;
  // Shared RAG convention (same as teacher/principal desks):
  // High red, Moderate amber, Low green.
  const variant = level === "High" ? "red" : level === "Moderate" ? "amber" : "green";
  return <Badge variant={variant}>{level}</Badge>;
}

/**
 * Latest referred ADM cases — one shared table list and header for the
 * guidance and nurse ADM referrals queues: LRN, Type, Case status,
 * Risk, Latest action, Time elapsed, Date referred, Row actions.
 * Roles map their rows onto the view-model and inject their own
 * action cells; dialogs and mutations stay with the callers.
 */
export function AdmQueueTable({
  title,
  description,
  searchPlaceholder,
  emptyTitle,
  emptyHint,
  rows,
  renderActions,
  riskLoading = false,
  limit,
  onRowClick,
  typeBadgeLabel = "ADM",
  glow = false,
}: {
  title: string;
  description: string;
  searchPlaceholder: string;
  emptyTitle: string;
  emptyHint: string;
  rows: AdmQueueRowVM[];
  renderActions: (id: string) => React.ReactNode;
  riskLoading?: boolean;
  /** Cap the visible list to the latest N rows (search still matches all). */
  limit?: number;
  /** Redirect on row click (keyboard-accessible). Omit for static rows. */
  onRowClick?: (id: string) => void;
  /** Type-column badge text. Defaults to "ADM" (queue tables); pass null
      to hide the Type column for non-case lists. */
  typeBadgeLabel?: string | null;
  /** Glow accent card treatment. Defaults off so existing queues render
      byte-identical. */
  glow?: boolean;
}) {
  const [query, setQuery] = React.useState("");
  const now = useNowTick();

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.searchText.toLowerCase().includes(q));
  }, [rows, query]);

  const visible = limit !== undefined ? filtered.slice(0, limit) : filtered;

  const searching = query.trim() !== "";

  return (
    <Card className={glow ? styles.glow : undefined}>
      {glow ? (
        <span className={styles.glowClip} aria-hidden="true">
          <span className={styles.cardGlow} />
        </span>
      ) : null}
      <CardHeader>
        <div className={styles.queueHeadRow}>
          <div>
            <CardTitle className={styles.title}>{title}</CardTitle>
            <CardDescription className={styles.desc}>{description}</CardDescription>
          </div>
          <div className={styles.searchWrap}>
            <Search className={styles.searchIcon} aria-hidden />
            <Input
              className={styles.search}
              style={{ height: "2rem" }}
              placeholder={searchPlaceholder}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label={searchPlaceholder}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {visible.length === 0 ? (
          <div className={styles.queueEmpty}>
            <p className={styles.queueEmptyTitle}>
              {searching ? "No cases match your search" : emptyTitle}
            </p>
            <p className={styles.queueEmptyHint}>
              {searching ? "Try a different name or keyword." : emptyHint}
            </p>
          </div>
        ) : (
          <div className={styles.tableWrap}>
            <Table aria-label={title}>
              <TableHeader>
                <TableRow>
                  <TableHead>LRN</TableHead>
                  {typeBadgeLabel !== null ? <TableHead>Type</TableHead> : null}
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
                {visible.map((row) => {
                  const actionMs = msSince(row.actionTime, now);
                  const LatestIcon = row.LatestIcon;
                  const clickable = onRowClick !== undefined;
                  return (
                    <TableRow
                      key={row.id}
                      className={clickable ? styles.clickableRow : undefined}
                      tabIndex={clickable ? 0 : undefined}
                      onClick={
                        clickable
                          ? (e) => {
                              // Action buttons handle their own clicks.
                              if ((e.target as HTMLElement).closest("button,a")) return;
                              onRowClick(row.id);
                            }
                          : undefined
                      }
                      onKeyDown={
                        clickable
                          ? (e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                onRowClick(row.id);
                              }
                            }
                          : undefined
                      }
                    >
                      <TableCell>
                        <p className={styles.cellMain}>
                          <span className={styles.lrn}>{row.lrn}</span>
                        </p>
                        <p className={styles.cellSub}>
                          {row.student} · {row.section}
                        </p>
                      </TableCell>
                      {typeBadgeLabel !== null ? (
                        <TableCell>
                          <Badge variant="secondary">{typeBadgeLabel}</Badge>
                        </TableCell>
                      ) : null}
                      <TableCell>
                        <Badge variant={row.statusVariant}>{row.statusLabel}</Badge>
                      </TableCell>
                      <TableCell>
                        <RiskBadge level={row.riskLevel} loading={riskLoading} />
                      </TableCell>
                      <TableCell>
                        <p className={styles.actionLabel}>
                          <LatestIcon className={styles.actionIcon} aria-hidden />
                          <span>{row.latestLabel}</span>
                        </p>
                      </TableCell>
                      <TableCell>
                        <p className={styles.cellTime} aria-live="off">
                          {actionMs === null ? "—" : `${formatElapsedShort(actionMs)} ago`}
                        </p>
                      </TableCell>
                      <TableCell>
                        <p className={styles.cellMain}>{row.dateReferred}</p>
                      </TableCell>
                      <TableCell>{renderActions(row.id)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
