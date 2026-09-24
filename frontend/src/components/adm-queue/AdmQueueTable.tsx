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

export type AdmQueueStatusVariant =
  | "warning"
  | "default"
  | "secondary"
  | "outline"
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
  const variant =
    level === "High" ? "destructive" : level === "Moderate" ? "warning" : "outline";
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
}: {
  title: string;
  description: string;
  searchPlaceholder: string;
  emptyTitle: string;
  emptyHint: string;
  rows: AdmQueueRowVM[];
  renderActions: (id: string) => React.ReactNode;
  riskLoading?: boolean;
}) {
  const [query, setQuery] = React.useState("");
  const now = useNowTick();

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.searchText.toLowerCase().includes(q));
  }, [rows, query]);

  const searching = query.trim() !== "";

  return (
    <Card>
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
        {filtered.length === 0 ? (
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
                {filtered.map((row) => {
                  const actionMs = msSince(row.actionTime, now);
                  const LatestIcon = row.LatestIcon;
                  return (
                    <TableRow key={row.id}>
                      <TableCell>
                        <p className={styles.cellMain}>
                          <span className={styles.lrn}>{row.lrn}</span>
                        </p>
                        <p className={styles.cellSub}>
                          {row.student} · {row.section}
                        </p>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">ADM</Badge>
                      </TableCell>
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
