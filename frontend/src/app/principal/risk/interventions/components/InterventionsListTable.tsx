"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Search,
  MoreHorizontal,
  ChevronDown,
  X,
} from "lucide-react";
import { usePersistentState } from "@/lib/hooks/usePersistentState";
import { useGradeMode } from "../../../grade-mode-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/sonner";
import type { RiskSnapshotStudent, RiskLevelKey } from "../types";
import { alertGuidance, apiErrorMessage, fetchInterventionStudents } from "../api";
import styles from "./InterventionsListTable.module.css";

const gradeNum = (name: string) => {
  const m = String(name).match(/(\d+)/);
  if (!m) return 0;
  const n = parseInt(m[1], 10);
  return Number.isNaN(n) ? 0 : n;
};

const PAGE_SIZE = 10;

const RISK_BADGE: Record<RiskLevelKey, "destructive" | "warning" | "outline"> = {
  High: "destructive",
  Moderate: "warning",
  Low: "outline",
};

function latestAction(s: RiskSnapshotStudent): { label: string; time: string } {
  const iv = s.intervention;
  if (!iv) return { label: "No follow-up yet", time: "" };
  const date = (iv.createdAt ?? "").slice(0, 10);
  if (iv.outcomeStatus === "resolved") return { label: "Marked resolved", time: date };
  if (iv.outcomeStatus === "unresolved") return { label: "Marked unresolved", time: date };
  return { label: "Intervention opened", time: date };
}

// Principal is read-only here: alerting is only offered while guidance has
// taken no action (no plan yet) — mirrors the server gate.
function canAlert(s: RiskSnapshotStudent): boolean {
  return !s.intervention || s.intervention.outcomeStatus === "unresolved";
}

export function InterventionsListTable({
  onSelect,
}: {
  onSelect: (student: RiskSnapshotStudent) => void;
}) {
  const queryClient = useQueryClient();
  const { gradeMode } = useGradeMode();
  const [query, setQuery] = usePersistentState<string>(
    "zentra.interventions.search",
    ""
  );
  const [riskFilter, setRiskFilter] = usePersistentState<"all" | RiskLevelKey>(
    "zentra.interventions.risk",
    "all"
  );
  const [sectionFilter, setSectionFilter] = usePersistentState<string>(
    "zentra.interventions.section",
    "all"
  );
  const [page, setPage] = React.useState(1);
  const [alertTarget, setAlertTarget] = React.useState<RiskSnapshotStudent | null>(null);
  const [note, setNote] = React.useState("");

  const { data, isPending } = useQuery({
    queryKey: ["interventions-list", gradeMode],
    queryFn: () => fetchInterventionStudents({ gradeMode }, 1, 1000),
  });

  const students = React.useMemo(() => data?.students ?? [], [data]);

  const sections = React.useMemo(() => {
    const seen = new Set<string>();
    for (const s of students) {
      if (s.section && s.section !== "—" && !seen.has(s.section)) seen.add(s.section);
    }
    return Array.from(seen).sort(
      (a, b) => gradeNum(a) - gradeNum(b) || a.localeCompare(b)
    );
  }, [students]);

  const gradeGroups = React.useMemo(() => {
    const map = new Map<number, string[]>();
    for (const s of sections) {
      const g = gradeNum(s);
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(s);
    }
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
  }, [sections]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return students.filter((s) => {
      const matchesQuery =
        !q || s.studentName.toLowerCase().includes(q) || s.lrn.toLowerCase().includes(q);
      const matchesSection = sectionFilter === "all" || s.section === sectionFilter;
      const matchesRisk = riskFilter === "all" || s.riskLevel === riskFilter;
      return matchesQuery && matchesSection && matchesRisk;
    });
  }, [students, query, sectionFilter, riskFilter]);

  const hasActiveFilters = sectionFilter !== "all" || riskFilter !== "all";
  const waitingCount = filtered.filter((s) => !s.intervention).length;

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const start = filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const end = Math.min(safePage * PAGE_SIZE, filtered.length);

  const alertMutation = useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) =>
      alertGuidance(id, note),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["interventions-list"] });
      toast.success({
        title: "Guidance alerted",
        description: alertTarget
          ? `Guidance counselors were notified about ${alertTarget.studentName}.`
          : "Guidance counselors were notified.",
      });
      setAlertTarget(null);
      setNote("");
    },
    onError: (err) => {
      toast.error({
        title: "Could not alert guidance",
        description: apiErrorMessage(
          err,
          "The alert did not go through. Check your connection and try again."
        ),
      });
    },
  });

  const closeAlert = () => {
    if (alertMutation.isPending) return;
    setAlertTarget(null);
    setNote("");
  };

  return (
    <section aria-label="Intervention cases" className={styles.feed}>
      <div className={styles.header}>
        <div className={styles.headerText}>
          <h2 className={styles.sectionTitle}>Intervention cases</h2>
          <p className={styles.sectionDesc} aria-live="polite">
            {filtered.length === 0
              ? "No at-risk students right now"
              : `${filtered.length} at-risk student${filtered.length === 1 ? "" : "s"} tracked from guidance interventions${
                  waitingCount > 0
                    ? ` · ${waitingCount} waiting for guidance action`
                    : ""
                }`}
          </p>
        </div>
        <div className={styles.headerActions}>
          <div className={styles.searchWrap}>
            <Search className={styles.searchIcon} aria-hidden />
            <Input
              className={styles.search}
              placeholder="Search student…"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              aria-label="Search at-risk students"
            />
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={`${styles.filterBtn} ${
                  sectionFilter !== "all" ? styles.filterActive : ""
                }`}
              >
                Section
                {sectionFilter !== "all" && <span className={styles.filterDot} aria-hidden />}
                <ChevronDown aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className={styles.filterMenu}>
              <DropdownMenuCheckboxItem
                checked={sectionFilter === "all"}
                onCheckedChange={() => {
                  setSectionFilter("all");
                  setPage(1);
                }}
              >
                All sections
              </DropdownMenuCheckboxItem>
              <DropdownMenuSeparator />
              {gradeGroups.length === 0 ? (
                <DropdownMenuItem disabled>No sections</DropdownMenuItem>
              ) : (
                gradeGroups.map(([grade, secs]) => (
                  <React.Fragment key={grade}>
                    <DropdownMenuLabel>Grade {grade}</DropdownMenuLabel>
                    {secs.map((s) => (
                      <DropdownMenuCheckboxItem
                        key={s}
                        checked={sectionFilter === s}
                        onCheckedChange={() => {
                          setSectionFilter(s);
                          setPage(1);
                        }}
                      >
                        {s}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </React.Fragment>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={`${styles.filterBtn} ${
                  riskFilter !== "all" ? styles.filterActive : ""
                }`}
              >
                Risk
                {riskFilter !== "all" && <span className={styles.filterDot} aria-hidden />}
                <ChevronDown aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className={styles.filterMenu}>
              <DropdownMenuCheckboxItem
                checked={riskFilter === "all"}
                onCheckedChange={() => {
                  setRiskFilter("all");
                  setPage(1);
                }}
              >
                All levels
              </DropdownMenuCheckboxItem>
              <DropdownMenuSeparator />
              {(["High", "Moderate", "Low"] as RiskLevelKey[]).map((lvl) => (
                <DropdownMenuCheckboxItem
                  key={lvl}
                  checked={riskFilter === lvl}
                  onCheckedChange={() => {
                    setRiskFilter(lvl);
                    setPage(1);
                  }}
                >
                  {lvl}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              className={styles.clearBtn}
              onClick={() => {
                setSectionFilter("all");
                setRiskFilter("all");
                setPage(1);
              }}
            >
              <X aria-hidden />
              Clear
            </Button>
          )}
        </div>
      </div>

      <div className={styles.tableBody}>
        {isPending ? (
          <SkeletonRows />
        ) : filtered.length === 0 ? (
          <p className={styles.empty}>
            {query.trim()
              ? `No interventions match "${query}".`
              : hasActiveFilters
                ? "No interventions match the selected filters."
                : "No intervention cases — nothing needs tracking right now."}
          </p>
        ) : (
          <div className={styles.tableWrap}>
            <Table aria-label="Intervention cases tracked by the principal">
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Grade</TableHead>
                  <TableHead>Section</TableHead>
                  <TableHead>Risk level</TableHead>
                  <TableHead>Detected</TableHead>
                  <TableHead>Latest action</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>
                    <span className={styles.srOnly}>Row actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRows.map((s) => {
                  const iv = s.intervention;
                  const action = latestAction(s);
                  return (
                    <TableRow
                      key={s.studentId}
                      className={styles.clickableRow}
                      onClick={() => onSelect(s)}
                    >
                      <TableCell>
                        <p className={styles.cellMain}>{s.studentName}</p>
                        <p className={styles.cellSub}>{s.lrn}</p>
                      </TableCell>
                      <TableCell>{s.gradeLevel}</TableCell>
                      <TableCell>{s.section}</TableCell>
                      <TableCell>
                        <Badge variant={RISK_BADGE[s.riskLevel]}>
                          {s.riskLevel}
                        </Badge>
                      </TableCell>
                      <TableCell>{s.snapshotDate ? s.snapshotDate.slice(0, 10) : "—"}</TableCell>
                      <TableCell>
                        <p className={styles.actionLabel}>{action.label}</p>
                        <p className={styles.cellSub}>{action.time || "—"}</p>
                      </TableCell>
                      <TableCell>
                        {iv ? (
                          <Badge
                            variant={
                              iv.outcomeStatus === "resolved"
                                ? "secondary"
                                : iv.outcomeStatus === "unresolved"
                                  ? "destructive"
                                  : "default"
                            }
                          >
                            {iv.outcomeStatus === "ongoing"
                              ? "Ongoing"
                              : iv.outcomeStatus === "resolved"
                                ? "Resolved"
                                : "Unresolved"}
                          </Badge>
                        ) : (
                          <span className={styles.noIntervention}>No plan</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8"
                              aria-label={`Actions for ${s.studentName}`}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreHorizontal aria-hidden />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => onSelect(s)}
                            >
                              View details
                            </DropdownMenuItem>
                            {canAlert(s) ? (
                              <DropdownMenuItem
                                onClick={() => {
                                  setAlertTarget(s);
                                  setNote("");
                                }}
                              >
                                Alert guidance
                              </DropdownMenuItem>
                            ) : null}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {Array.from({ length: PAGE_SIZE - pageRows.length }).map((_, i) => (
                  <TableRow key={`page-filler-${i}`} aria-hidden="true">
                    <TableCell colSpan={8} />
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        <div className={styles.pager}>
          <p className={styles.range}>
            Showing {start}–{end} of {filtered.length}
          </p>
          <div className={styles.pagerButtons}>
            <Button
              size="xs"
              variant="outline"
              disabled={safePage <= 1 || filtered.length === 0}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <span className={styles.pageLabel} aria-live="polite">
              {`Page ${safePage} of ${totalPages}`}
            </span>
            <Button
              size="xs"
              variant="outline"
              disabled={safePage >= totalPages || filtered.length === 0}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      </div>

      <Dialog
        open={alertTarget !== null}
        onOpenChange={(open) => {
          if (!open) closeAlert();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alert guidance</DialogTitle>
            <DialogDescription>
              {alertTarget
                ? `${alertTarget.studentName} (${alertTarget.lrn}) has no intervention action yet. This notifies every active guidance counselor.`
                : "Notify every active guidance counselor."}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional note for guidance…"
            rows={3}
            maxLength={500}
            aria-label="Optional note for guidance"
          />
          <DialogFooter>
            <Button variant="outline" onClick={closeAlert}>
              Cancel
            </Button>
            <Button
              disabled={alertMutation.isPending || !alertTarget}
              onClick={() => {
                if (!alertTarget) return;
                alertMutation.mutate({ id: alertTarget.studentId, note });
              }}
            >
              {alertMutation.isPending ? "Alerting…" : "Alert guidance"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function SkeletonRows() {
  return (
    <div className={styles.tableWrap}>
      <Table aria-label="Loading intervention cases">
        <TableHeader>
          <TableRow>
            <TableHead>Student</TableHead>
            <TableHead>Grade</TableHead>
            <TableHead>Section</TableHead>
            <TableHead>Risk level</TableHead>
            <TableHead>Detected</TableHead>
            <TableHead>Latest action</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>
              <span className={styles.srOnly}>Row actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: PAGE_SIZE }).map((_, i) => (
            <TableRow key={i}>
              <TableCell>
                <Skeleton className={styles.skelName} />
                <Skeleton className={styles.skelLrn} />
              </TableCell>
              <TableCell>
                <Skeleton className={styles.skelCell} />
              </TableCell>
              <TableCell>
                <Skeleton className={styles.skelCell} />
              </TableCell>
              <TableCell>
                <Skeleton className={styles.skelCell} />
              </TableCell>
              <TableCell>
                <Skeleton className={styles.skelCell} />
              </TableCell>
              <TableCell>
                <Skeleton className={styles.skelCell} />
              </TableCell>
              <TableCell>
                <Skeleton className={styles.skelCell} />
              </TableCell>
              <TableCell />
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
