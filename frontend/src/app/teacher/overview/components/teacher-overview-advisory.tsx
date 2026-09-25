"use client";

import * as React from "react";
import {
  BookOpen,
  CalendarClock,
  ChevronDown,
  MoreHorizontal,
  Search,
  ShieldAlert,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
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
import type { AdvisoryStatusRow } from "./teacher-overview-data";
import styles from "./teacher-overview-advisory.module.css";

const PAGE_SIZE = 10;

type StatusFilter = "" | AdvisoryStatusRow["riskLevel"];

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "", label: "All statuses" },
  { value: "Low", label: "Low" },
  { value: "Moderate", label: "Moderate" },
  { value: "High", label: "High" },
];

interface StatusBadgeProps {
  level: AdvisoryStatusRow["riskLevel"];
}

function StatusBadge({ level }: StatusBadgeProps) {
  const variant = level === "High" ? "destructive" : level === "Moderate" ? "warning" : "outline";
  return <Badge variant={variant}>{level}</Badge>;
}

interface FlagBadgeProps {
  flag: AdvisoryStatusRow["flag"];
  flags?: AdvisoryStatusRow["flags"];
}

const FLAG_ICONS = {
  academic: BookOpen,
  attendance: CalendarClock,
  behavioral: ShieldAlert,
} as const;

function FlagBadge({ flag, flags }: FlagBadgeProps) {
  const active = flags && flags.length > 0 ? flags : flag === "none" ? [] : [flag];
  if (active.length === 0) return null;
  return (
    <span className={styles.flagList}>
      {active.map((f) => {
        const Icon = FLAG_ICONS[f];
        return (
          <span key={f} className={styles.flagBadge}>
            <Icon aria-hidden />
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </span>
        );
      })}
    </span>
  );
}

interface TeacherOverviewAdvisoryProps {
  students: AdvisoryStatusRow[];
}

/* Advisory-students card — outer Card shell with the guidance alerts
   table pattern inside: header row (title + search/status filter),
   plain table, pager footer. */
export function TeacherOverviewAdvisory({ students }: TeacherOverviewAdvisoryProps) {
  const [query, setQuery] = React.useState("");
  const [status, setStatus] = React.useState<StatusFilter>("");
  const [page, setPage] = React.useState(1);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return students.filter((s) => {
      if (status !== "" && s.riskLevel !== status) return false;
      if (q !== "") {
        return (
          s.name.toLowerCase().includes(q) ||
          s.section.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [students, query, status]);

  const clearFilters = React.useCallback(() => {
    setQuery("");
    setStatus("");
    setPage(1);
  }, []);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const start = total === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const end = Math.min(safePage * PAGE_SIZE, total);
  const statusLabel = STATUS_OPTIONS.find((o) => o.value === status)?.label ?? "All statuses";
  const hasActiveFilters = query.trim() !== "" || status !== "";
  const hasRows = students.length > 0;

  return (
    <Card className={styles.card} aria-label="Advisory students">
      <CardHeader className={styles.header}>
        <div className={styles.headerText}>
          <h2 className={styles.sectionTitle}>Advisory Students</h2>
          <p className={styles.sectionDesc}>
            Status for your advisees — {total} student{total === 1 ? "" : "s"}. Category
            only, never the private write-up.
          </p>
        </div>
        {hasRows && (
          <CardAction className={styles.headerActions}>
            <div className={styles.searchWrap}>
              <Search className={styles.searchIcon} aria-hidden />
              <Input
                className={styles.search}
                style={{ height: "2rem" }}
                placeholder="Search student…"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(1);
                }}
                aria-label="Search advisory students"
              />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  style={{ height: "2rem" }}
                  aria-label={`Filter students by status, currently showing: ${statusLabel}`}
                  className={`${styles.filterBtn} ${status !== "" ? styles.filterActive : ""}`}
                >
                  {status === "" ? "Status" : statusLabel}
                  {status !== "" && <span className={styles.filterDot} aria-hidden />}
                  <ChevronDown aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className={styles.filterMenu}>
                {STATUS_OPTIONS.map((item) => (
                  <DropdownMenuCheckboxItem
                    key={item.label}
                    checked={status === item.value}
                    onCheckedChange={() => {
                      setStatus(item.value);
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
          </CardAction>
        )}
      </CardHeader>
      <CardContent className={styles.content}>
        {!hasRows ? (
          <p className={styles.empty}>No advisory students.</p>
        ) : filtered.length === 0 ? (
          <p className={styles.empty}>No students match your search and filters.</p>
        ) : (
          <Table aria-label="Advisory students">
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Flag</TableHead>
                <TableHead>
                  <span className={styles.srOnly}>Row actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageRows.map((s) => (
                <TableRow key={s.studentId}>
                  <TableCell>
                    <p className={styles.cellMain}>{s.name}</p>
                    <p className={styles.cellSub}>{s.section}</p>
                  </TableCell>
                  <TableCell><StatusBadge level={s.riskLevel} /></TableCell>
                  <TableCell><FlagBadge flag={s.flag} flags={s.flags} /></TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-8">
                          <MoreHorizontal aria-hidden />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>{s.name}</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setQuery(s.name)}>
                          Filter by name
                        </DropdownMenuItem>
                        <DropdownMenuItem disabled>View student profile</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
      <CardFooter className={styles.footer}>
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
      </CardFooter>
    </Card>
  );
}
