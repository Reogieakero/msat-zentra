"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Search,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import { usePersistentState } from "@/lib/hooks/usePersistentState";
import { useGradeMode } from "../../../grade-mode-context";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
import type { RiskSnapshotStudent, RiskLevelKey } from "../types";
import { fetchInterventionStudents } from "../api";
import styles from "./InterventionsListTable.module.css";

const gradeNum = (name: string) => {
  const m = String(name).match(/(\d+)/);
  if (!m) return 0;
  const n = parseInt(m[1], 10);
  return Number.isNaN(n) ? 0 : n;
};

const PAGE_SIZE = 8;

const RISK_BADGE: Record<RiskLevelKey, "destructive" | "warning" | "outline"> = {
  High: "destructive",
  Moderate: "warning",
  Low: "outline",
};

const FACTOR_LABELS: Record<string, string> = {
  academic: "Academic",
  attendance: "Attendance",
  behavioral: "Behavioral",
};

export function InterventionsListTable({
  onSelect,
}: {
  onSelect: (student: RiskSnapshotStudent) => void;
}) {
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

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const start = filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const end = Math.min(safePage * PAGE_SIZE, filtered.length);

  return (
    <Card className={styles.card}>
      <CardHeader className={styles.header}>
        <div className={styles.headerText}>
          <CardTitle>Intervention Queue</CardTitle>
          <CardDescription>
            {sectionFilter === "all"
              ? "All at-risk learners requiring intervention."
              : `At-risk learners in ${sectionFilter} requiring intervention.`}
          </CardDescription>
        </div>
        <CardAction className={styles.headerActions}>
          <div className={styles.searchWrap}>
            <Search className={styles.searchIcon} aria-hidden />
            <Input
              className={styles.search}
              placeholder="Search name or LRN…"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              aria-label="Search interventions"
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
        </CardAction>
      </CardHeader>

      <CardContent className={styles.content}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Student</TableHead>
              <TableHead>Section</TableHead>
              <TableHead>Risk</TableHead>
              <TableHead>Factors</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isPending ? (
              <SkeletonRows />
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className={styles.empty}>
                  {query.trim()
                    ? `No interventions match "${query}".`
                    : hasActiveFilters
                      ? "No interventions match the selected filters."
                      : "No interventions found."}
                </TableCell>
              </TableRow>
            ) : (
              pageRows.map((s) => {
                const iv = s.intervention;
                return (
                  <TableRow
                    key={s.studentId}
                    className={styles.clickableRow}
                    onClick={() => onSelect(s)}
                  >
                    <TableCell>
                      <div className={styles.studentCell}>
                        <span className={styles.studentName}>{s.studentName}</span>
                        <span className={styles.studentLrn}>{s.lrn}</span>
                      </div>
                    </TableCell>
                    <TableCell className={styles.section}>{s.section}</TableCell>
                    <TableCell>
                      <Badge variant={RISK_BADGE[s.riskLevel]} className={styles.riskBadge}>
                        {s.riskLevel}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className={styles.factors}>
                        {(Object.keys(s.factors) as (keyof typeof s.factors)[]).map((f) => (
                          <span
                            key={f}
                            className={`${styles.factorChip} ${
                              s.factors[f] ? styles.factorOn : styles.factorOff
                            }`}
                          >
                            {FACTOR_LABELS[f]}
                          </span>
                        ))}
                      </span>
                    </TableCell>
                    <TableCell>
                      {iv ? (
                        <Badge variant={iv.outcomeStatus === "resolved" ? "secondary" : iv.outcomeStatus === "unresolved" ? "destructive" : "default"} className={styles.statusBadge}>
                          {iv.outcomeStatus === "ongoing" ? "Ongoing" : iv.outcomeStatus === "resolved" ? "Resolved" : "Unresolved"}
                        </Badge>
                      ) : (
                        <span className={styles.noIntervention}>No plan</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="size-8">
                            <MoreHorizontal aria-hidden />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => onSelect(s)}>View details</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onSelect(s)}>View intervention</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </CardContent>

      <CardFooter className={styles.footer}>
        <span className={styles.footerInfo}>
          {filtered.length > 0 ? `${start}–${end} of ${filtered.length}` : "0 of 0"}
        </span>
        <div className={styles.footerActions}>
          <Button
            variant="outline"
            size="sm"
            disabled={safePage <= 1 || filtered.length === 0}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft aria-hidden />
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={safePage >= totalPages || filtered.length === 0}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
            <ChevronRight aria-hidden />
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <TableRow key={i}>
          <TableCell>
            <div className={styles.studentCell}>
              <Skeleton className={styles.skelName} />
              <Skeleton className={styles.skelLrn} />
            </div>
          </TableCell>
          <TableCell>
            <Skeleton className={styles.skelCell} style={{ width: "50%" }} />
          </TableCell>
          <TableCell>
            <Skeleton className={styles.skelCell} style={{ width: "38%" }} />
          </TableCell>
          <TableCell>
            <span className={styles.factors}>
              <Skeleton className={styles.skelChip} />
              <Skeleton className={styles.skelChip} />
              <Skeleton className={styles.skelChip} />
            </span>
          </TableCell>
          <TableCell>
            <Skeleton className={styles.skelCell} style={{ width: "60%" }} />
          </TableCell>
          <TableCell />
        </TableRow>
      ))}
    </>
  );
}
