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
import { Badge } from "@/components/ui/badge";
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
import {
  Search,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  X,
} from "lucide-react";
import {
  CATEGORY_COLORS,
  humanize,
  type MockAnecdotalCategory,
  type MockAnecdotalRecord,
} from "./anecdotal-workspace-mock";
import styles from "./AnecdotalList.module.css";

const PAGE_SIZE = 15;

const CATEGORIES: MockAnecdotalCategory[] = [
  "behavioral",
  "bullying",
  "academic",
  "attendance",
  "health",
];

interface AnecdotalListProps {
  records: MockAnecdotalRecord[];
  onSelect: (record: MockAnecdotalRecord) => void;
}

export function AnecdotalList({ records, onSelect }: AnecdotalListProps) {
  const [category, setCategory] = useState<"all" | MockAnecdotalCategory>("all");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  const needle = query.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      records.filter((r) => {
        if (category !== "all" && r.category !== category) return false;
        if (!needle) return true;
        return (
          r.studentName.toLowerCase().includes(needle) ||
          r.incident.toLowerCase().includes(needle)
        );
      }),
    [records, category, needle]
  );

  const hasActiveFilters = category !== "all";

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const start = filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const end = Math.min(safePage * PAGE_SIZE, filtered.length);

  return (
    <Card className={styles.card}>
      <CardHeader className={styles.header}>
        <div className={styles.headerText}>
          <CardTitle>My records</CardTitle>
          <CardDescription>
            {records.length} record{records.length === 1 ? "" : "s"} filed by you this term.
          </CardDescription>
        </div>
        <CardAction className={styles.headerActions}>
          <div className={styles.searchWrap}>
            <Search className={styles.searchIcon} aria-hidden />
            <Input
              className={styles.search}
              placeholder="Search student or incident…"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              aria-label="Search anecdotal records"
            />
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={`${styles.filterBtn} ${category !== "all" ? styles.filterActive : ""}`}
              >
                Category
                {category !== "all" && <span className={styles.filterDot} aria-hidden />}
                <ChevronDown aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className={styles.filterMenu}>
              <DropdownMenuCheckboxItem
                checked={category === "all"}
                onCheckedChange={() => {
                  setCategory("all");
                  setPage(1);
                }}
              >
                All categories
              </DropdownMenuCheckboxItem>
              <DropdownMenuSeparator />
              {CATEGORIES.map((c) => (
                <DropdownMenuCheckboxItem
                  key={c}
                  checked={category === c}
                  onCheckedChange={() => {
                    setCategory(c);
                    setPage(1);
                  }}
                >
                  {humanize(c)}
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
                setCategory("all");
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
              <TableHead>Date</TableHead>
              <TableHead>Student</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Tier</TableHead>
              <TableHead>Follow-ups</TableHead>
              <TableHead>Referral</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className={styles.empty}>
                  {needle
                    ? `No records match "${query}".`
                    : hasActiveFilters
                      ? "No records match the selected filters."
                      : "No anecdotal records yet — file the first one."}
                </TableCell>
              </TableRow>
            ) : (
              pageRows.map((r) => (
                <TableRow
                  key={r.id}
                  className={styles.clickableRow}
                  onClick={() => onSelect(r)}
                >
                  <TableCell className={styles.date}>{r.observationDate}</TableCell>
                  <TableCell className={styles.student}>{r.studentName}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={styles.categoryBadge}
                      style={{ "--record": CATEGORY_COLORS[r.category] } as React.CSSProperties}
                    >
                      {humanize(r.category)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={r.tier === "Confidential" ? "destructive" : "secondary"}>
                      {r.tier}
                    </Badge>
                  </TableCell>
                  <TableCell className={styles.dim}>{r.followups.length}</TableCell>
                  <TableCell className={styles.dim}>
                    {r.referred ? (r.referralTarget ?? "Referred") : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          aria-label={`Actions for record on ${r.studentName}`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreHorizontal aria-hidden />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>{r.studentName}</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelect(r);
                          }}
                        >
                          View details
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
