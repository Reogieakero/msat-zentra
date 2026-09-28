"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Search,
  MoreHorizontal,
  ChevronDown,
  X,
} from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { usePersistentState } from "@/lib/hooks/usePersistentState";
import { useGradeMode } from "../../../grade-mode-context";
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
import { FACTOR_LABELS, type BackendStudent, type RiskFactor, type RiskLevelKey } from "../api";
import styles from "./StudentsListTable.module.css";

const gradeNum = (name: string) => {
  const m = String(name).match(/(\d+)/);
  if (!m) return 0;
  const n = parseInt(m[1], 10);
  return Number.isNaN(n) ? 0 : n;
};

const PAGE_SIZE = 20;

const RISK_BADGE: Record<RiskLevelKey, "destructive" | "warning" | "outline"> = {
  High: "destructive",
  Moderate: "warning",
  Low: "outline",
};

export function StudentsListTable({
  selectedSection,
  onSectionChange,
}: {
  selectedSection: string;
  onSectionChange: (section: string) => void;
}) {
  const { gradeMode } = useGradeMode();
  const [query, setQuery] = usePersistentState<string>(
    "zentra.risk.students.search",
    ""
  );
  const [riskFilter, setRiskFilter] = usePersistentState<"all" | RiskLevelKey>(
    "zentra.risk.students.risk",
    "all"
  );
  const [page, setPage] = React.useState(1);

  const { data, isPending } = useQuery({
    queryKey: ["risk-students-list", gradeMode],
    queryFn: async () => {
      const res = await apiClient.get<{ students: BackendStudent[]; total: number }>(
        "/api/risk/students",
        { params: { pageSize: 1000, gradeMode } }
      );
      return res.data;
    },
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
        !q || s.name.toLowerCase().includes(q) || s.lrn.toLowerCase().includes(q);
      const matchesSection = selectedSection === "all" || s.section === selectedSection;
      const matchesRisk = riskFilter === "all" || s.riskLevel === riskFilter;
      return matchesQuery && matchesSection && matchesRisk;
    });
  }, [students, query, selectedSection, riskFilter]);

  const hasActiveFilters =
    query.trim() !== "" || selectedSection !== "all" || riskFilter !== "all";

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const start = total === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const end = Math.min(safePage * PAGE_SIZE, total);

  const clearFilters = React.useCallback(() => {
    setQuery("");
    onSectionChange("all");
    setRiskFilter("all");
    setPage(1);
  }, [onSectionChange, setQuery, setRiskFilter]);

  return (
    <section aria-label="At-risk students">
      <div className={styles.header}>
        <div className={styles.headerText}>
          <h2 className={styles.sectionTitle}>At-Risk Students</h2>
          <p className={styles.sectionDesc}>
            {selectedSection === "all"
              ? `All at-risk learners across every section — ${total} student${total === 1 ? "" : "s"}.`
              : `At-risk learners in ${selectedSection} — ${total} student${total === 1 ? "" : "s"}.`}
          </p>
        </div>
        <div className={styles.headerActions}>
          <div className={styles.searchWrap}>
            <Search className={styles.searchIcon} aria-hidden />
            <Input
              className={styles.search}
              style={{ height: "2rem" }}
              placeholder="Search name or LRN…"
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
                style={{ height: "2rem" }}
                aria-label={`Filter students by section, currently showing: ${selectedSection === "all" ? "All sections" : selectedSection}`}
                className={`${styles.filterBtn} ${
                  selectedSection !== "all" ? styles.filterActive : ""
                }`}
              >
                {selectedSection === "all" ? "Section" : selectedSection}
                {selectedSection !== "all" && <span className={styles.filterDot} aria-hidden />}
                <ChevronDown aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className={styles.filterMenu}>
              <DropdownMenuCheckboxItem
                checked={selectedSection === "all"}
                onCheckedChange={() => {
                  onSectionChange("all");
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
                        checked={selectedSection === s}
                        onCheckedChange={() => {
                          onSectionChange(s);
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
                style={{ height: "2rem" }}
                aria-label={`Filter students by risk level, currently showing: ${riskFilter === "all" ? "All levels" : riskFilter}`}
                className={`${styles.filterBtn} ${
                  riskFilter !== "all" ? styles.filterActive : ""
                }`}
              >
                {riskFilter === "all" ? "Risk" : riskFilter}
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
            <Button variant="ghost" size="sm" className={styles.clearBtn} onClick={clearFilters}>
              <X aria-hidden />
              Show all
            </Button>
          )}
        </div>
      </div>

      <div className={styles.tableBody}>
        {isPending ? (
          <div className={styles.tableWrap}>
            <Table aria-label="At-risk students">
              <TableHeader>
                <TableRow>
                  <TableHead>LRN</TableHead>
                  <TableHead>Risk</TableHead>
                  <TableHead>Factors</TableHead>
                  <TableHead>
                    <span className={styles.srOnly}>Row actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <SkeletonRows />
              </TableBody>
            </Table>
          </div>
        ) : filtered.length === 0 ? (
          <p className={styles.empty}>
            {query.trim()
              ? `No students match “${query}”.`
              : hasActiveFilters
                ? "No students match the selected filters."
                : "No at-risk students — nothing needs attention right now."}
          </p>
        ) : (
          <div className={styles.tableWrap}>
            <Table aria-label="At-risk students">
              <TableHeader>
                <TableRow>
                  <TableHead>LRN</TableHead>
                  <TableHead>Risk</TableHead>
                  <TableHead>Factors</TableHead>
                  <TableHead>
                    <span className={styles.srOnly}>Row actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRows.map((s) => (
                  <TableRow key={s.studentId}>
                    <TableCell>
                      <p className={styles.cellMain}>
                        <span className={styles.lrn}>{s.lrn}</span>
                      </p>
                      <p className={styles.cellSub}>
                        {s.name} · {s.section}
                      </p>
                    </TableCell>
                    <TableCell>
                      <Badge variant={RISK_BADGE[s.riskLevel]}>{s.riskLevel}</Badge>
                    </TableCell>
                    <TableCell>
                      <span className={styles.factors}>
                        {(Object.keys(s.factors) as RiskFactor[]).map((f) => (
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
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="size-8" aria-label={`Actions for ${s.name}`}>
                            <MoreHorizontal aria-hidden />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>View details</DropdownMenuItem>
                          <DropdownMenuItem>Assign intervention</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem>Send alert</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
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

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <TableRow key={i}>
          <TableCell>
            <span className={styles.skelName} />
            <span className={styles.skelLrn} />
          </TableCell>
          <TableCell>
            <span className={styles.skelCell} style={{ width: "38%" }} />
          </TableCell>
          <TableCell>
            <span className={styles.factors}>
              <span className={styles.skelChip} />
              <span className={styles.skelChip} />
              <span className={styles.skelChip} />
            </span>
          </TableCell>
          <TableCell />
        </TableRow>
      ))}
    </>
  );
}
