"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Search,
} from "lucide-react";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchRegistrarOverview } from "./overview-data";
import styles from "./OverviewApprovals.module.css";

const PAGE_SIZE = 5;

export function OverviewApprovals() {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [page, setPage] = React.useState(1);

  const { data, isPending, isError } = useQuery({
    queryKey: ["registrar-overview"],
    queryFn: fetchRegistrarOverview,
  });

  const goAccounts = React.useCallback(() => {
    router.push("/registrar/accounts");
  }, [router]);

  const pendingStudents = React.useMemo(() => {
    const all = [...(data?.pendingStudents ?? [])].sort((a, b) =>
      a.name.localeCompare(b.name)
    );
    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all.filter((s) => `${s.name} ${s.lrn}`.toLowerCase().includes(q));
  }, [data, query]);

  const total = pendingStudents.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = pendingStudents.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const start = total === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const end = Math.min(safePage * PAGE_SIZE, total);

  return (
    <Card className={styles.card}>
      <CardHeader className={styles.header}>
        <div className={styles.headerText}>
          <CardTitle>Pending Approvals</CardTitle>
          <CardDescription>
            Approvals and follow-ups that need registrar attention this term.
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
              aria-label="Search pending students"
            />
          </div>
          <Button variant="outline" size="sm" onClick={goAccounts}>
            View all
            <ArrowRight aria-hidden />
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className={styles.content}>
        {isPending ? (
          <div className={styles.tableWrap}>
            <Skeleton className={styles.tableSkel} />
          </div>
        ) : isError ? (
          <p className={styles.empty}>Could not load overview figures.</p>
        ) : (
          <div className={styles.tableWrap}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Grade</TableHead>
                  <TableHead>Parent / Guardian</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className={styles.empty}>
                      {query.trim()
                        ? `No pending students match "${query}".`
                        : "All caught up — no pending student enrollments in the G11–12 band."}
                    </TableCell>
                  </TableRow>
                ) : (
                  pageRows.map((s) => (
                    <TableRow key={s.lrn} className={styles.clickableRow} onClick={goAccounts}>
                      <TableCell>
                        <div className={styles.studentCell}>
                          <span className={styles.studentName}>{s.name}</span>
                          <span className={styles.studentLrn}>{s.lrn}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className={styles.gradeTag}>{s.grade}</span>
                      </TableCell>
                      <TableCell className={styles.parentCell}>{s.parent}</TableCell>
                      <TableCell>
                        <Badge variant="warning" className={styles.statusBadge}>
                          Pending
                        </Badge>
                      </TableCell>
                      <TableCell className={styles.menuCell}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8"
                              aria-label={`Actions for ${s.name}`}
                            >
                              <MoreHorizontal aria-hidden />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={goAccounts}>View details</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
      <CardFooter className={styles.footer}>
        <span className={styles.footerInfo}>
          {total > 0 ? `${start}–${end} of ${total}` : "0 of 0"}
        </span>
        <div className={styles.footerActions}>
          <Button
            variant="outline"
            size="sm"
            disabled={safePage <= 1 || total === 0}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft aria-hidden />
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={safePage >= totalPages || total === 0}
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
