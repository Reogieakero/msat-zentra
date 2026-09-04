"use client";

import { useMemo, useState } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  X,
} from "lucide-react";
import {
  formatBirthdate,
  initialsOf,
  type AdviseeRiskLevel,
  type AdviseeRow,
  type DrawerSection,
} from "./advisory-students-data";
import styles from "./StudentTable.module.css";

const PAGE_SIZE = 15;

type Filter = "all" | AdviseeRiskLevel;

const RISK_VARIANTS = {
  Low: "outline",
  Moderate: "warning",
  High: "destructive",
} as const;

interface StudentTableProps {
  students: AdviseeRow[];
  loading: boolean;
  onSelect: (studentId: string, section: DrawerSection | null) => void;
}

export function StudentTable({ students, loading, onSelect }: StudentTableProps) {
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  const counts = useMemo(() => {
    const c: Record<Filter, number> = {
      all: students.length,
      Low: 0,
      Moderate: 0,
      High: 0,
    };
    for (const s of students) c[s.riskLevel] += 1;
    return c;
  }, [students]);

  const needle = query.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      students.filter((s) => {
        if (filter !== "all" && s.riskLevel !== filter) return false;
        if (!needle) return true;
        return (
          s.name.toLowerCase().includes(needle) ||
          s.lrn.includes(needle) ||
          s.section.toLowerCase().includes(needle)
        );
      }),
    [students, filter, needle]
  );

  const hasActiveFilters = filter !== "all";
  const sectionName = students[0]?.section ?? "";

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const start = filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const end = Math.min(safePage * PAGE_SIZE, filtered.length);

  return (
    <Card className={styles.card}>
      <CardHeader className={styles.header}>
        <div className={styles.headerText}>
          <CardTitle>{sectionName ? `${sectionName} · Advisory` : "Advisory"}</CardTitle>
          <CardDescription>
            Students in your advisory section. Click a row for details.
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
              aria-label="Search advisory students"
            />
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={`${styles.filterBtn} ${filter !== "all" ? styles.filterActive : ""}`}
              >
                Risk
                {filter !== "all" && <span className={styles.filterDot} aria-hidden />}
                <ChevronDown aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className={styles.filterMenu}>
              <DropdownMenuCheckboxItem
                checked={filter === "all"}
                onCheckedChange={() => {
                  setFilter("all");
                  setPage(1);
                }}
              >
                All levels ({counts.all})
              </DropdownMenuCheckboxItem>
              <DropdownMenuSeparator />
              {(["High", "Moderate", "Low"] as AdviseeRiskLevel[]).map((lvl) => (
                <DropdownMenuCheckboxItem
                  key={lvl}
                  checked={filter === lvl}
                  onCheckedChange={() => {
                    setFilter(lvl);
                    setPage(1);
                  }}
                >
                  {lvl} ({counts[lvl]})
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
                setFilter("all");
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
              <TableHead>LRN</TableHead>
              <TableHead>Birthday</TableHead>
              <TableHead>Gender</TableHead>
              <TableHead>At-Risk Level</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <SkeletonRows />
            ) : pageRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className={styles.empty}>
                  {needle
                    ? `No students match "${query}".`
                    : hasActiveFilters
                      ? "No students match the selected filters."
                      : "No advisory students."}
                </TableCell>
              </TableRow>
            ) : (
              pageRows.map((s) => (
                <TableRow
                  key={s.studentId}
                  className={styles.clickableRow}
                  onClick={() => onSelect(s.studentId, null)}
                >
                  <TableCell>
                    <span className={styles.student}>
                      <span className={styles.avatar} aria-hidden>
                        {initialsOf(s.name)}
                      </span>
                      <span className={styles.nameRow}>
                        <span className={styles.name}>{s.name}</span>
                        {!s.hasAccount ? (
                          <Badge variant="outline" className={styles.noAccount}>
                            No account
                          </Badge>
                        ) : null}
                      </span>
                    </span>
                  </TableCell>
                  <TableCell className={styles.lrn}>{s.lrn}</TableCell>
                  <TableCell className={styles.lrn}>{formatBirthdate(s.birthdate)}</TableCell>
                  <TableCell>{s.gender ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={RISK_VARIANTS[s.riskLevel]}>{s.riskLevel}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          aria-label={`Actions for ${s.name}`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreHorizontal aria-hidden />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>{s.name}</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelect(s.studentId, "anecdotal");
                          }}
                        >
                          View anecdotal
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelect(s.studentId, "attendance");
                          }}
                        >
                          View attendance
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelect(s.studentId, "grades");
                          }}
                        >
                          View academic
                        </DropdownMenuItem>
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
            <span className={styles.student}>
              <Skeleton className={styles.skelAvatar} />
              <Skeleton className={styles.skelName} />
            </span>
          </TableCell>
          <TableCell>
            <Skeleton className={styles.skelCell} style={{ width: "60%" }} />
          </TableCell>
          <TableCell>
            <Skeleton className={styles.skelCell} style={{ width: "50%" }} />
          </TableCell>
          <TableCell>
            <Skeleton className={styles.skelCell} style={{ width: "40%" }} />
          </TableCell>
          <TableCell>
            <Skeleton className={styles.skelCell} style={{ width: "45%" }} />
          </TableCell>
          <TableCell />
        </TableRow>
      ))}
    </>
  );
}
