"use client";
import * as React from "react";
import {
  BellRing,
  ChevronDown,
  Search,
  SearchX,
  X,
} from "lucide-react";
import { GuidanceEmptyState } from "../../components/GuidanceEmptyCard";
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
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  GuidanceReferralItem,
  GuidanceRiskLevel,
} from "@/services/guidance/guidance.types";
import type { AtRiskStudentItem } from "@/services/guidance/interventions.types";
import { useNowTick } from "@/lib/clock";
import {
  actionTimeOf,
  rowKey,
  rowRisk,
  rowSearchText,
  rowType,
  type GuidanceAlertRow,
  type TypeFilter,
} from "./guidance-alerts-helpers";
import { CaseTableRow } from "./guidance-alerts-row";
import styles from "./guidance-alerts-table.module.css";
export type { GuidanceAlertRow };
const PAGE_SIZE = 15;
const TYPE_OPTIONS: { value: TypeFilter; label: string }[] = [
  { value: "", label: "All types" },
  { value: "ADM", label: "ADM" },
  { value: "Counseling", label: "Counseling" },
  { value: "Intervention", label: "Intervention" },
];
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
  const typeLabel = TYPE_OPTIONS.find((o) => o.value === type)?.label ?? "All types";
  const hasActiveFilters = query.trim() !== "" || type !== "";
  const hasRows = rows.length > 0;
  return (
    <section aria-label="Referred cases" className={styles.panel}>
      <span className={styles.glowClip} aria-hidden="true">
        <span className={styles.cardGlow} />
      </span>
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
          <GuidanceEmptyState
            icon={BellRing}
            title="No referred cases"
            hint="No referred cases — nothing needs your attention right now."
          />
        ) : filtered.length === 0 ? (
          <GuidanceEmptyState
            icon={SearchX}
            title="No cases match your search"
            hint="Try a different name or keyword, or clear the search and filters."
          />
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
        {totalPages > 1 && (
          <div className={styles.pager}>
            <p className={styles.range}>
              {total} case{total === 1 ? "" : "s"}
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
        )}
      </div>
    </section>
  );
}
