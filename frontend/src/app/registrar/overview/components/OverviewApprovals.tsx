"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  UserCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";
import styles from "./OverviewApprovals.module.css";

// Overview preview pager: 10 rows per page (registrar overview standard).
// The full queue with server search lives on the Accounts page.
const PAGE_SIZE = 10;

export function OverviewApprovals() {
  const router = useRouter();
  const [page, setPage] = React.useState(1);

  const { data, isPending, isError } = useQuery({
    queryKey: ["registrar-overview"],
    queryFn: fetchRegistrarOverview,
  });

  const goAccounts = React.useCallback(() => {
    router.push("/registrar/accounts");
  }, [router]);

  const pendingStudents = React.useMemo(() => {
    return [...(data?.pendingStudents ?? [])].sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  }, [data]);

  const total = pendingStudents.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = pendingStudents.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const start = total === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const end = Math.min(safePage * PAGE_SIZE, total);
  const hasRecords = (data?.pendingStudents ?? []).length > 0;

  return (
    <section className={assign.card} aria-labelledby="overview-pending-approvals">
      <span className={assign.glowClip} aria-hidden="true">
        <span className={assign.cardGlow} />
      </span>
      <div className={`${styles.header} relative`}>
        <div className={styles.headerText}>
          <h2 id="overview-pending-approvals" className="text-base font-semibold">
            Pending Approvals
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Approvals and follow-ups that need registrar attention this term.
          </p>
        </div>
        <div className={styles.headerActions}>
          <Button variant="link" size="sm" className={styles.viewAll} onClick={goAccounts}>
            View all
          </Button>
        </div>
      </div>
      <div className={`${styles.content} relative`}>
        {isPending ? (
          <div className={styles.tableWrap}>
            <Skeleton className={styles.tableSkel} />
          </div>
        ) : isError ? (
          <p className={styles.empty}>Could not load overview figures.</p>
        ) : !hasRecords ? (
          <div className={styles.emptyBlock}>
            <span className={styles.emptyIcon} aria-hidden>
              <UserCheck />
            </span>
            <p className={styles.emptyTitle}>All caught up</p>
            <p className={styles.emptyHint}>
              No pending student enrollments in the G11–12 band.
            </p>
          </div>
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
                {pageRows.map((s) => (
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
                        <Badge variant="amber" className={styles.statusBadge}>
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
                  ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
      {hasRecords && (
        <div className={`${styles.footer} relative`}>
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
        </div>
      )}
    </section>
  );
}
