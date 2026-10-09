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
import { formatElapsedShort, msSinceDate as msSince, useNowTick } from "@/lib/clock";
import { useDebouncedValue } from "@/lib/useDebouncedValue";

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

  actionTime: string | null;
  dateReferred: string;
}

function RiskBadge({ level, loading = false }: { level: AdmQueueRisk | undefined; loading?: boolean }) {
  if (loading && !level)
    return (
      <span className={styles.noRisk} role="status" aria-label="Loading risk level">
        …
      </span>
    );
  if (!level) return <span className={styles.noRisk}>—</span>;

  const variant = level === "High" ? "red" : level === "Moderate" ? "amber" : "green";
  return <Badge variant={variant}>{level}</Badge>;
}

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
  searchValue,
  onSearchChange,
}: {
  title: string;
  description: string;
  searchPlaceholder: string;
  emptyTitle: string;
  emptyHint: string;
  rows: AdmQueueRowVM[];
  renderActions: (id: string) => React.ReactNode;
  riskLoading?: boolean;

  limit?: number;

  onRowClick?: (id: string) => void;

  typeBadgeLabel?: string | null;

  glow?: boolean;

  searchValue?: string;
  onSearchChange?: (value: string) => void;
}) {
  const [innerQuery, setInnerQuery] = React.useState("");
  const now = useNowTick();
  const controlled = onSearchChange !== undefined;
  const query = controlled ? (searchValue ?? "") : innerQuery;
  const setQuery = controlled ? onSearchChange : setInnerQuery;
  const debouncedQuery = useDebouncedValue(query, 300);
  const activeQuery = controlled ? query : debouncedQuery;

  const filtered = React.useMemo(() => {
    if (controlled) return rows;
    const q = debouncedQuery.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.searchText.toLowerCase().includes(q));
  }, [rows, debouncedQuery, controlled]);

  const visible = limit !== undefined ? filtered.slice(0, limit) : filtered;

  const searching = activeQuery.trim() !== "";

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
