"use client";
import * as React from "react";
import {
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  flexRender,
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
} from "@tanstack/react-table";
import {
  ShieldCheck,
  Check,
  ArrowLeftRight,
  FolderOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { PrincipalEmptyState } from "../../../../components/PrincipalEmptyCard";
import type { AdmReferralRow } from "@/services/principal/adm.types";
import {
  stageLabel,
  isAwaitingSignature,
  canReturn,
  type AdmCase,
} from "../../../adm";
import styles from "../all.module.css";
function asCase(r: AdmReferralRow): AdmCase {
  return {
    id: r.id,
    student: r.student,
    lrn: r.lrn,
    grade: r.grade,
    section: r.section ?? "",
    stage: r.stage,
    eligibilityStatus: r.eligibilityStatus,
    meetingAttended: false,
    modulesSubmitted: 0,
    modulesTotal: 0,
    deviceIssued: false,
    preparedBy: r.preparedBy,
    datePrepared: r.datePrepared,
    approvedBy: r.approvedBy,
    approvalDate: r.approvalDate,
    forms: r.forms,
  };
}
const STAGE_BADGE: Record<
  string,
  "outline" | "blue" | "amber" | "green" | "default" | "secondary"
> = {
  anecdotal: "outline",
  consultation: "blue",
  meeting_parents: "amber",
  home_visitation: "green",
  certification: "blue",
  principal_approval: "default",
  enrollment_monitoring: "green",
  completion: "secondary",
};
function eligibilityBadge(status: AdmReferralRow["eligibilityStatus"]) {
  if (status === "eligible")
    return <Badge variant="secondary">Eligible</Badge>;
  if (status === "ineligible")
    return <Badge variant="destructive">Ineligible</Badge>;
  return <Badge variant="outline">Pending</Badge>;
}
export function AdmReferralsTable({
  rows,
  totalCount,
  loading,
  isFetching = false,
  error,
  search,
  actionId,
  safePage,
  totalPages,
  start,
  end,
  onRequestSign,
  onRequestReturn,
  onViewForms,
  onPrev,
  onNext,
}: {
  rows: AdmReferralRow[];
  totalCount: number;
  loading: boolean;
  isFetching?: boolean;
  error: string | null;
  search: string;
  actionId: string | null;
  safePage: number;
  totalPages: number;
  start: number;
  end: number;
  onRequestSign: (id: string) => void;
  onRequestReturn: (id: string) => void;
  onViewForms: (row: AdmReferralRow) => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] =
    React.useState<ColumnFiltersState>([]);
  const columns = React.useMemo<ColumnDef<AdmReferralRow>[]>(
    () => [
      {
        id: "student",
        accessorFn: (row) => row.student,
        header: "Student",
        size: 220,
        minSize: 220,
        maxSize: 220,
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className={styles.cellMain}>{row.original.student}</p>
            <p className={styles.cellSub}>
              {row.original.lrn}
              {row.original.section ? ` · ${row.original.section}` : ""}
            </p>
          </div>
        ),
      },
      {
        id: "grade",
        accessorFn: (row) => row.grade,
        header: "Grade",
        size: 80,
        minSize: 80,
        maxSize: 80,
        cell: ({ row }) => (
          <span className={styles.muted}>{row.original.grade}</span>
        ),
      },
      {
        id: "stage",
        accessorFn: (row) => stageLabel(row.stage),
        header: "Stage",
        size: 170,
        minSize: 170,
        maxSize: 170,
        cell: ({ row }) => (
          <Badge
            variant={STAGE_BADGE[row.original.stage] ?? "outline"}
            className={styles.stageBadge}
          >
            {stageLabel(row.original.stage)}
          </Badge>
        ),
      },
      {
        id: "eligibility",
        accessorFn: (row) => row.eligibilityStatus,
        header: "Eligibility",
        size: 130,
        minSize: 130,
        maxSize: 130,
        cell: ({ row }) => eligibilityBadge(row.original.eligibilityStatus),
      },
      {
        id: "approval",
        accessorFn: (row) =>
          isAwaitingSignature(asCase(row))
            ? "0-awaiting"
            : row.approvedBy
              ? "2-signed"
              : "1-pending",
        header: "Approval",
        size: 180,
        minSize: 180,
        maxSize: 180,
        cell: ({ row }) => {
          const r = row.original;
          const awaiting = isAwaitingSignature(asCase(r));
          if (awaiting) {
            return (
              <span className={styles.actionBtns}>
                <Button
                  variant="outline"
                  size="icon-sm"
                  aria-label={`Sign and approve case for ${r.student}`}
                  title="Sign & approve"
                  disabled={actionId !== null}
                  aria-busy={actionId === r.id}
                  onClick={() => onRequestSign(r.id)}
                >
                  {actionId === r.id ? (
                    <Spinner aria-hidden />
                  ) : (
                    <Check aria-hidden />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Return case for ${r.student} for revision`}
                  title="Return for revision"
                  disabled={actionId !== null}
                  onClick={() => onRequestReturn(r.id)}
                >
                  <ArrowLeftRight aria-hidden />
                </Button>
              </span>
            );
          }
          if (r.approvedBy) {
            return (
              <Badge variant="secondary" className={styles.stageBadge}>
                Signed
              </Badge>
            );
          }
          return (
            <span className={styles.actionBtns}>
              <span className={styles.approvalPending}>Awaiting signature</span>
              {canReturn(asCase(r)) ? (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Return case for ${r.student} for revision`}
                  title="Return for revision"
                  onClick={() => onRequestReturn(r.id)}
                >
                  <ArrowLeftRight aria-hidden />
                </Button>
              ) : null}
            </span>
          );
        },
      },
      {
        id: "forms",
        accessorFn: (row) => row.forms?.length ?? 0,
        header: "Forms",
        size: 140,
        minSize: 140,
        maxSize: 140,
        cell: ({ row }) => {
          const r = row.original;
          const count = r.forms?.length ?? 0;
          if (count === 0)
            return <span className={styles.noForms}>No forms</span>;
          return (
            <Button
              variant="outline"
              size="sm"
              className={styles.formsBtn}
              aria-label={`View ${count} linked form${count === 1 ? "" : "s"} for ${r.student}`}
              title={`${count} linked form${count === 1 ? "" : "s"}`}
              onClick={() => onViewForms(r)}
            >
              <FolderOpen aria-hidden />
              {count}
            </Button>
          );
        },
      },
      {
        id: "date",
        accessorFn: (row) => row.approvalDate ?? row.datePrepared,
        header: "Date",
        size: 120,
        minSize: 120,
        maxSize: 120,
        cell: ({ row }) => (
          <span className={styles.mono}>
            {row.original.approvalDate ?? row.original.datePrepared}
          </span>
        ),
      },
    ],
    [actionId, onRequestSign, onRequestReturn, onViewForms],
  );
  const table = useReactTable({
    data: rows,
    columns,
    getRowId: (row) => row.id,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    state: { sorting, columnFilters },
  });
  if (loading) {
    return (
      <div className="relative overflow-x-auto rounded-md border">
        <Table className="w-full table-fixed" aria-label="Loading referral cases">
          <TableHeader>
            <TableRow className="bg-muted/50 [&>th]:border-t-0">
              {[
                "Student",
                "Grade",
                "Stage",
                "Eligibility",
                "Approval",
                "Forms",
                "Date",
              ].map((h) => (
                <TableHead key={h} className="h-10 whitespace-nowrap">
                  {h}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 10 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell>
                  <Skeleton className={styles.skelName} />
                  <Skeleton className={styles.skelLrn} />
                </TableCell>
                {Array.from({ length: 6 }).map((__, j) => (
                  <TableCell key={j}>
                    <Skeleton className={styles.skelCell} />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }
  if (error) {
    return (
      <p className={styles.empty} role="alert">
        {error}
      </p>
    );
  }
  if (totalCount === 0) {
    return (
      <PrincipalEmptyState
        icon={ShieldCheck}
        title="No referrals found"
        hint={
          search.trim()
            ? `No referrals match "${search}".`
            : "Endorsed cases will appear here once filed."
        }
      />
    );
  }
  return (
    <>
      <div className="relative overflow-x-auto rounded-md border" aria-busy={isFetching || undefined}>
        <Table className="w-full table-fixed" aria-label="ADM referral cases">
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow
                key={headerGroup.id}
                className="bg-muted/50 [&>th]:border-t-0"
              >
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    style={{ width: header.getSize() }}
                    onClick={header.column.getToggleSortingHandler()}
                    className="h-10 cursor-pointer truncate whitespace-nowrap select-none"
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      style={{ width: cell.column.getSize() }}
                      className="truncate"
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  No referrals match your search.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      {totalPages > 1 && (
        <div className="relative flex items-center justify-end space-x-2">
          <div className="text-muted-foreground flex-1 text-sm">
            {totalCount > 0 ? `${start}–${end} of ${totalCount}` : "0 of 0"}
          </div>
          <div className="space-x-2">
            <Button
              variant="outline"
              size="sm"
              disabled={safePage <= 1 || totalCount === 0}
              onClick={onPrev}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={safePage >= totalPages || totalCount === 0}
              onClick={onNext}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
