"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronLeft,
  ChevronRight,
  FileText,
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  fetchRecordKeeperOverview,
  fetchRegistrarOverview,
  type RegistryDesk,
} from "@/services/registry/overview.service";
import { formatSection } from "@/lib/utils";
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";
import styles from "./OverviewApprovals.module.css";

// Overview preview pager: 10 rows (registrar) / 5 rows (record-keeper).
// The full list lives on the SF10 page.
const PAGE_SIZE_BY_DESK: Record<RegistryDesk, number> = {
  registrar: 10,
  "record-keeper": 5,
};

export function MissingSf10Table({ desk }: { desk: RegistryDesk }) {
  const router = useRouter();
  const [page, setPage] = React.useState(1);
  const PAGE_SIZE = PAGE_SIZE_BY_DESK[desk];

  const { data, isPending, isError } = useQuery({
    queryKey: [`${desk}-overview`],
    queryFn: desk === "registrar" ? fetchRegistrarOverview : fetchRecordKeeperOverview,
    staleTime: 30_000,
  });

  const goSf10 = React.useCallback(() => {
    router.push(`/${desk}/sf10`);
  }, [router, desk]);

  const rows = React.useMemo(() => {
    return [...(data?.missingSf10 ?? [])].sort((a, b) =>
      a.student.localeCompare(b.student)
    );
  }, [data]);

  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = rows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const start = total === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const end = Math.min(safePage * PAGE_SIZE, total);
  const hasRecords = (data?.missingSf10 ?? []).length > 0;

  return (
    <section className={assign.card} aria-labelledby="overview-missing-sf10">
      <span className={assign.glowClip} aria-hidden="true">
        <span className={assign.cardGlow} />
      </span>
      <div className={`${styles.header} relative`}>
        <div className={styles.headerText}>
          <h2 id="overview-missing-sf10" className="text-base font-semibold">
            Missing SF10 Records
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            G11–12 students with no SF10 record on file yet.
          </p>
        </div>
        <div className={styles.headerActions}>
          <Button variant="link" size="sm" className={styles.viewAll} onClick={goSf10}>
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
          <p className={styles.empty}>Could not load missing SF10 records.</p>
        ) : !hasRecords ? (
          <div className={styles.emptyBlock}>
            <span className={styles.emptyIcon} aria-hidden>
              <FileText />
            </span>
            <p className={styles.emptyTitle}>All caught up</p>
            <p className={styles.emptyHint}>
              Every G11–12 student has an SF10 record on file.
            </p>
          </div>
        ) : (
          <div className={styles.tableWrap}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Grade</TableHead>
                  <TableHead>Section</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRows.map((s) => (
                    <TableRow key={s.lrn} className={styles.clickableRow} onClick={goSf10}>
                      <TableCell>
                        <div className={styles.studentCell}>
                          <span className={styles.studentName}>{s.student}</span>
                          <span className={styles.studentLrn}>{s.lrn}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className={styles.gradeTag}>{s.grade}</span>
                      </TableCell>
                      <TableCell className={styles.parentCell}>
                        {formatSection(s.section)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="warning" className={styles.statusBadge}>
                          Missing
                        </Badge>
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
