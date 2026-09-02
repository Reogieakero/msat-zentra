"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, MoreHorizontal, ChevronLeft, ChevronRight, ChevronDown, X } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { usePersistentState } from "@/lib/hooks/usePersistentState";
import { useGradeMode } from "../../grade-mode-context";
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
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
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
import type { RiskLevelKey } from "../riskBoard";
import styles from "./InterventionTrackingTable.module.css";

type OutcomeStatus = "ongoing" | "resolved" | "unresolved";
type ApprovalStatus = "pending" | "approved" | "rejected" | "modified";

interface InterventionLink {
  id: string;
  recommendedAction: string;
  assignedTo: string | null;
  assignedStaffName: string | null;
  approvalStatus: ApprovalStatus;
  outcomeStatus: OutcomeStatus;
  createdAt: string | null;
}

interface InterventionStudent {
  studentId: string;
  lrn: string;
  studentName: string;
  section: string;
  riskLevel: RiskLevelKey;
  intervention: InterventionLink | null;
}

const SECTION_LABEL: Record<OutcomeStatus, string> = {
  ongoing: "Ongoing",
  resolved: "Resolved",
  unresolved: "Unresolved",
};

const OUTCOME_VARIANT: Record<OutcomeStatus, "warning" | "outline" | "destructive"> = {
  ongoing: "warning",
  resolved: "outline",
  unresolved: "destructive",
};

const PAGE_SIZE = 8;

const gradeNum = (name: string) => {
  const m = String(name).match(/(\d+)/);
  if (!m) return 0;
  const n = parseInt(m[1], 10);
  return Number.isNaN(n) ? 0 : n;
};

export function InterventionTrackingTable() {
  const { gradeMode } = useGradeMode();
  const [query, setQuery] = usePersistentState<string>(
    "zentra.risk.interventions.search",
    ""
  );
  const [statusFilter, setStatusFilter] = usePersistentState<"all" | OutcomeStatus>(
    "zentra.risk.interventions.status",
    "all"
  );
  const [riskFilter, setRiskFilter] = usePersistentState<"all" | RiskLevelKey>(
    "zentra.risk.interventions.risk",
    "all"
  );
  const [page, setPage] = React.useState(1);

  const { data, isPending } = useQuery({
    queryKey: ["risk-interventions", gradeMode],
    queryFn: async () => {
      const res = await apiClient.get<{
        students: InterventionStudent[];
        total: number;
      }>("/api/risk/interventions", {
        params: { pageSize: 1000, hasIntervention: true, gradeMode },
      });
      return res.data;
    },
  });

  const intervened = React.useMemo(
    () => (data?.students ?? []).filter((s) => s.intervention),
    [data]
  );

  const sections = React.useMemo(
    () =>
      Array.from(new Set(intervened.map((s) => s.section)))
        .filter((s) => s !== "—")
        .sort((a, b) => gradeNum(a) - gradeNum(b) || a.localeCompare(b)),
    [intervened]
  );

  const gradeGroups = React.useMemo(() => {
    const map = new Map<number, string[]>();
    for (const s of sections) {
      const g = gradeNum(s);
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(s);
    }
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
  }, [sections]);

  const [sectionFilter, setSectionFilter] = usePersistentState<string>(
    "zentra.risk.interventions.section",
    "all"
  );

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return intervened.filter((s) => {
      const matchesQuery =
        !q ||
        s.studentName.toLowerCase().includes(q) ||
        s.lrn.toLowerCase().includes(q);
      const matchesSection = sectionFilter === "all" || s.section === sectionFilter;
      const matchesStatus =
        statusFilter === "all" || s.intervention?.outcomeStatus === statusFilter;
      const matchesRisk = riskFilter === "all" || s.riskLevel === riskFilter;
      return matchesQuery && matchesSection && matchesStatus && matchesRisk;
    });
  }, [intervened, query, sectionFilter, statusFilter, riskFilter]);

  const hasActiveFilters =
    sectionFilter !== "all" || statusFilter !== "all" || riskFilter !== "all";

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const start = filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const end = Math.min(safePage * PAGE_SIZE, filtered.length);

  const clearFilters = () => {
    setSectionFilter("all");
    setStatusFilter("all");
    setRiskFilter("all");
    setPage(1);
  };

  return (
    <Card className={styles.card}>
      <CardHeader className={styles.header}>
        <div className={styles.headerText}>
          <CardTitle>Intervention Tracking</CardTitle>
          <CardDescription>
            At-risk students with active or past interventions, and their outcome
            status.
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
                  statusFilter !== "all" ? styles.filterActive : ""
                }`}
              >
                Status
                {statusFilter !== "all" && <span className={styles.filterDot} aria-hidden />}
                <ChevronDown aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className={styles.filterMenu}>
              <DropdownMenuCheckboxItem
                checked={statusFilter === "all"}
                onCheckedChange={() => {
                  setStatusFilter("all");
                  setPage(1);
                }}
              >
                All statuses
              </DropdownMenuCheckboxItem>
              <DropdownMenuSeparator />
              {(Object.keys(SECTION_LABEL) as OutcomeStatus[]).map((st) => (
                <DropdownMenuCheckboxItem
                  key={st}
                  checked={statusFilter === st}
                  onCheckedChange={() => {
                    setStatusFilter(st);
                    setPage(1);
                  }}
                >
                  {SECTION_LABEL[st]}
                </DropdownMenuCheckboxItem>
              ))}
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
                All risk levels
              </DropdownMenuCheckboxItem>
              <DropdownMenuSeparator />
              {(["High", "Moderate"] as RiskLevelKey[]).map((r) => (
                <DropdownMenuCheckboxItem
                  key={r}
                  checked={riskFilter === r}
                  onCheckedChange={() => {
                    setRiskFilter(r);
                    setPage(1);
                  }}
                >
                  {r}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {hasActiveFilters && (
            <Button variant="ghost" size="sm" className={styles.clearBtn} onClick={clearFilters}>
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
              <TableHead>Assigned to</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Recommended action</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isPending ? (
              <SkeletonRows />
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className={styles.empty}>
                  {query.trim()
                    ? `No interventions match “${query}”.`
                    : hasActiveFilters
                      ? "No interventions match the selected filters."
                      : "No students with interventions."}
                </TableCell>
              </TableRow>
            ) : (
              pageRows.map((s) => (
                <TableRow key={s.studentId}>
                  <TableCell>
                    <div className={styles.studentCell}>
                      <span className={styles.studentName}>{s.studentName}</span>
                      <span className={styles.studentLrn}>{s.lrn}</span>
                    </div>
                  </TableCell>
                  <TableCell className={styles.section}>{s.section}</TableCell>
                  <TableCell>
                    <Badge variant={s.riskLevel === "High" ? "destructive" : "warning"}>
                      {s.riskLevel}
                    </Badge>
                  </TableCell>
                  <TableCell className={styles.assignee}>
                    {s.intervention?.assignedStaffName ?? "—"}
                  </TableCell>
                  <TableCell>
                    {s.intervention ? (
                      <Badge variant={OUTCOME_VARIANT[s.intervention.outcomeStatus]}>
                        {SECTION_LABEL[s.intervention.outcomeStatus]}
                      </Badge>
                    ) : (
                      <span className={styles.muted}>—</span>
                    )}
                  </TableCell>
                  <TableCell className={styles.action}>
                    {s.intervention?.recommendedAction ?? "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-8">
                          <MoreHorizontal aria-hidden />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>View details</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem>Send alert</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
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
              <span className={styles.skelName} />
              <span className={styles.skelLrn} />
            </div>
          </TableCell>
          <TableCell>
            <span className={styles.skelCell} style={{ width: "50%" }} />
          </TableCell>
          <TableCell>
            <span className={styles.skelCell} style={{ width: "38%" }} />
          </TableCell>
          <TableCell>
            <span className={styles.skelCell} style={{ width: "60%" }} />
          </TableCell>
          <TableCell>
            <span className={styles.skelCell} style={{ width: "46%" }} />
          </TableCell>
          <TableCell>
            <span className={styles.skelCell} style={{ width: "70%" }} />
          </TableCell>
          <TableCell />
        </TableRow>
      ))}
    </>
  );
}
