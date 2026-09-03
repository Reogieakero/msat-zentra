"use client";

import * as React from "react";
import { Search, MoreHorizontal, ChevronLeft, ChevronRight } from "lucide-react";
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
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { AdvisoryStatusRow } from "./teacher-overview-data";
import styles from "./teacher-overview-advisory.module.css";

const PAGE_SIZE = 5;

interface StatusBadgeProps {
  level: AdvisoryStatusRow["riskLevel"];
}

function StatusBadge({ level }: StatusBadgeProps) {
  const variant = level === "High" ? "destructive" : level === "Moderate" ? "warning" : "outline";
  return <Badge variant={variant}>{level}</Badge>;
}

interface FlagBadgeProps {
  flag: AdvisoryStatusRow["flag"];
}

interface FlagBadgeProps {
  flag: AdvisoryStatusRow["flag"];
  flags?: AdvisoryStatusRow["flags"];
}

function FlagBadge({ flag, flags }: FlagBadgeProps) {
  const active = flags && flags.length > 0 ? flags : flag === "none" ? [] : [flag];
  if (active.length === 0) return null;
  return (
    <span className={styles.flagList}>
      {active.map((f) => (
        <span key={f} className={styles.flagBadge}>
          {f.charAt(0).toUpperCase() + f.slice(1)}
        </span>
      ))}
    </span>
  );
}

interface TeacherOverviewAdvisoryProps {
  students: AdvisoryStatusRow[];
}

export function TeacherOverviewAdvisory({ students }: TeacherOverviewAdvisoryProps) {
  const statusCounts = React.useMemo(() => {
    const counts = { Low: 0, Moderate: 0, High: 0 };
    students.forEach((s) => { counts[s.riskLevel] += 1; });
    return counts;
  }, [students]);

  const [query, setQuery] = React.useState("");
  const [page, setPage] = React.useState(1);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return students;
    return students.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.section.toLowerCase().includes(q)
    );
  }, [students, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const start = filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const end = Math.min(safePage * PAGE_SIZE, filtered.length);

  return (
    <>
      <Card className={styles.card}>
        <CardHeader className={styles.header}>
          <div className={styles.headerText}>
            <CardTitle>Advisory Students</CardTitle>
            <CardDescription>
              Status breakdown for your advisees. You see the category only, never the private write-up.
            </CardDescription>
          </div>
          <CardAction className={styles.headerActions}>
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
                aria-label="Search advisory students"
              />
            </div>
          </CardAction>
        </CardHeader>
        <CardContent className={styles.content}>
          <div className={styles.statusGrid}>
            <div className={styles.statusChip}>
              <span className={styles.statusLabel}>Low</span>
              <span className={styles.statusCount}>{statusCounts.Low}</span>
            </div>
            <div className={styles.statusChip}>
              <span className={styles.statusLabel}>Moderate</span>
              <span className={styles.statusCount}>{statusCounts.Moderate}</span>
            </div>
            <div className={styles.statusChip}>
              <span className={styles.statusLabel}>High</span>
              <span className={styles.statusCount}>{statusCounts.High}</span>
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Section</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Flag</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className={styles.empty}>
                    {query.trim()
                      ? `No students match "${query}".`
                      : "No advisory students."}
                  </TableCell>
                </TableRow>
              ) : (
                pageRows.map((s) => (
                  <TableRow key={s.studentId}>
                    <TableCell className={styles.cellSubject}>{s.name}</TableCell>
                    <TableCell className={styles.section}>{s.section}</TableCell>
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
    </>
  );
}
