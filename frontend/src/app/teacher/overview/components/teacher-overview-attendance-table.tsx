"use client";

import * as React from "react";
import {
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  flexRender,
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
} from "@tanstack/react-table";
import { SearchIcon, Users } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupInput, InputGroupAddon } from "@/components/ui/input-group";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import styles from "./teacher-overview-advisory.module.css";
import { useTerm } from "@/lib/term/TermContext";
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";
import { cn } from "@/lib/utils";

interface MatrixSubject {
  id: string;
  name: string;
  code: string;
}

interface MatrixStudent {
  studentId: string;
  name: string;
  lrn: string;
  rates: Record<string, number | null>;
}

interface AverageRow {
  studentId: string;
  name: string;
  lrn: string;
  average: number;
  risk: "Low" | "Moderate" | "High";
}

function overallAverage(rates: Record<string, number | null>): number {
  const rated = Object.values(rates).filter((r): r is number => r !== null);
  if (rated.length === 0) return 0;
  return rated.reduce((sum, r) => sum + r, 0) / rated.length;
}

const ATTENDANCE_AT_RISK_CUTOFF = 0.8;

function riskOf(average: number): "Low" | "Moderate" | "High" {
  if (average >= 0.9) return "Low";
  if (average >= ATTENDANCE_AT_RISK_CUTOFF) return "Moderate";
  return "High";
}

function riskBadge(risk: "Low" | "Moderate" | "High"): {
  variant: "green" | "amber" | "red";
} {
  if (risk === "High") return { variant: "red" };
  if (risk === "Moderate") return { variant: "amber" };
  return { variant: "green" };
}

function rateClass(rate: number): string {
  if (rate >= 0.9) return "text-green-600 dark:text-green-500";
  if (rate >= ATTENDANCE_AT_RISK_CUTOFF) return "text-amber-600 dark:text-amber-500";
  return "text-red-600 dark:text-red-500";
}

export function TeacherOverviewAttendanceTable({ sectionId }: { sectionId: string }) {
  const { activeTerm } = useTerm();
  const termKey = `${activeTerm?.schoolYearId ?? ""}:${activeTerm?.termId ?? ""}`;
  const matrixQuery = useQuery({
    queryKey: ["attendance-section-matrix", sectionId, termKey],
    queryFn: async () => {
      const params = new URLSearchParams({ sectionId });
      const { data } = await apiClient.get<{
        sectionId: string;
        sectionName: string;
        termId: string;
        subjects: MatrixSubject[];
        students: MatrixStudent[];
      }>(`/api/attendance/section-subject-matrix?${params.toString()}`);
      return data;
    },
    retry: false,
  });

  const data = React.useMemo<AverageRow[]>(
    () =>
      (matrixQuery.data?.students ?? []).map((s) => {
        const average = overallAverage(s.rates);
        return {
          studentId: s.studentId,
          name: s.name,
          lrn: s.lrn,
          average,
          risk: riskOf(average),
        };
      }),
    [matrixQuery.data],
  );

  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);

  const columns = React.useMemo<ColumnDef<AverageRow>[]>(() => {
    const badge = (risk: AverageRow["risk"]) => riskBadge(risk);
    return [
      {
        id: "student",
        accessorFn: (row) => row.name,
        header: "Student",
        size: 220,
        minSize: 220,
        maxSize: 220,
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className={styles.cellMain}>{row.original.name}</p>
            <p className={styles.cellSub}>{row.original.lrn}</p>
          </div>
        ),
      },
      {
        id: "average",
        accessorFn: (row) => row.average,
        header: "Average",
        size: 130,
        minSize: 130,
        maxSize: 130,
        cell: ({ row }) => (
          <div className={cn("font-medium tabular-nums", rateClass(row.original.average))}>
            {Math.round(row.original.average * 100)}%
          </div>
        ),
      },
      {
        id: "risk",
        accessorFn: (row) => row.risk,
        header: "Risk",
        size: 200,
        minSize: 200,
        maxSize: 200,
        cell: ({ row }) => {
          const b = badge(row.original.risk);
          return (
            <Badge variant={b.variant}>
              {row.original.risk}
            </Badge>
          );
        },
      },
    ];
  }, []);

  const table = useReactTable({
    data,
    columns,
    getRowId: (row) => row.studentId,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    initialState: { pagination: { pageSize: 15 } },
    state: { sorting, columnFilters },
  });

  return (
    <section aria-label="Advisory attendance" className="flex min-w-0 flex-col gap-3">
      {matrixQuery.isPending ? (
        <div className="flex flex-col gap-2" aria-busy="true" aria-label="Loading attendance">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="h-10 rounded-md bg-muted" />
          ))}
        </div>
      ) : matrixQuery.isError ? (
        <p role="alert" className="text-sm text-destructive">
          Could not load advisory attendance.
        </p>
      ) : data.length === 0 ? (
        <div className={assign.card}>
          <span className={assign.glowClip} aria-hidden="true">
            <span className={assign.cardGlow} />
          </span>
          <div className="relative flex flex-col items-center gap-2 py-6 text-center">
            <span
              className="flex h-12 w-12 items-center justify-center rounded-full bg-muted"
              aria-hidden="true"
            >
              <Users size={24} className="text-muted-foreground" />
            </span>
            <p className="font-medium">No students in this section yet</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Attendance for this advisory section will appear here once students are enrolled.
            </p>
          </div>
        </div>
      ) : (
        <div className={assign.card}>
          <span className={assign.glowClip} aria-hidden="true">
            <span className={assign.cardGlow} />
          </span>
          <div className="relative flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className={styles.sectionTitle}>
                Advisory Attendance{matrixQuery.data ? ` · ${matrixQuery.data.sectionName}` : ""}
              </h2>
              <p className={styles.sectionDesc}>
                General average present across all subjects this term — below 80% is at-risk (same as the engine).
              </p>
            </div>
            <InputGroup className="max-w-40 shrink-0">
              <InputGroupInput
                placeholder="Filter students..."
                value={(table.getColumn("student")?.getFilterValue() as string) ?? ""}
                onChange={(event) =>
                  table.getColumn("student")?.setFilterValue(event.target.value)
                }
                aria-label="Filter students"
              />
              <InputGroupAddon>
                <SearchIcon />
              </InputGroupAddon>
            </InputGroup>
          </div>
          <div className="relative overflow-x-auto rounded-md border">
            <Table className="w-full table-fixed">
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id} className="bg-muted/50 [&>th]:border-t-0">
                    {headerGroup.headers.map((header) => (
                      <TableHead
                        key={header.id}
                        style={{ width: header.getSize() }}
                        onClick={header.column.getToggleSortingHandler()}
                        className="h-10 cursor-pointer truncate whitespace-nowrap select-none"
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
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
                      No students match your search.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <div className="relative flex items-center justify-end space-x-2">
            <div className="text-muted-foreground flex-1 text-sm">
              {table.getFilteredRowModel().rows.length} student
              {table.getFilteredRowModel().rows.length === 1 ? "" : "s"}
            </div>
            {table.getPageCount() > 1 && (
              <div className="space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage()}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => table.nextPage()}
                  disabled={!table.getCanNextPage()}
                >
                  Next
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
