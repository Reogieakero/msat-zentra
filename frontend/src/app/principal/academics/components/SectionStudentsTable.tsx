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
import { SearchIcon } from "lucide-react";
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
import { RiskBadge } from "./RiskBadge";
import type { SectionSummary, StudentRow } from "@/services/principal/academics";
import type { GradeMode } from "../../grade-mode-context";
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";
import styles from "./SectionStudentsTable.module.css";

export function liveAverage(st: StudentRow, mode: GradeMode): number | null {
  if (st.subjects.length === 0) return null;
  const vals = st.subjects.map((s) =>
    mode === "final" ? s.transmutedGrade : s.computedAverage,
  );
  return vals.reduce((sum, v) => sum + v, 0) / vals.length;
}

interface SectionStudentsTableProps {
  section: SectionSummary;
  gradeMode: GradeMode;
}

type Tone = "high" | "moderate" | "low";

function toneClass(tone: Tone | null): string {
  if (tone === "high") return `${styles.cellMain} text-red-700 dark:text-red-400`;
  if (tone === "moderate") return `${styles.cellMain} text-amber-700 dark:text-amber-400`;
  if (tone === "low") return `${styles.cellMain} text-green-700 dark:text-green-400`;
  return styles.cellMuted;
}

function averageTone(avg: number | null): Tone | null {
  if (avg === null) return null;
  if (avg < 75) return "high";
  if (avg < 80) return "moderate";
  return "low";
}

function attendanceTone(rate: number, hasRecords: boolean): Tone | null {
  if (!hasRecords) return null;
  if (rate < 80) return "high";
  if (rate < 90) return "moderate";
  return "low";
}

export function SectionStudentsTable({
  section,
  gradeMode,
}: SectionStudentsTableProps) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);

  const columns = React.useMemo<ColumnDef<StudentRow>[]>(
    () => [
      {
        id: "name",
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
        accessorFn: (row) => liveAverage(row, gradeMode) ?? -1,
        header: gradeMode === "final" ? "Average" : "Raw avg",
        size: 120,
        minSize: 120,
        maxSize: 120,
        cell: ({ row }) => {
          const avg = liveAverage(row.original, gradeMode);
          return (
            <span className={toneClass(averageTone(avg))}>
              {avg === null ? "—" : avg.toFixed(1)}
            </span>
          );
        },
      },
      {
        id: "attendance",
        accessorFn: (row) => row.attendanceRatePct,
        header: "Attendance",
        size: 130,
        minSize: 130,
        maxSize: 130,
        cell: ({ row }) => {
          const hasRecords = row.original.schoolDays > 0;
          return (
            <span className={toneClass(attendanceTone(row.original.attendanceRatePct, hasRecords))}>
              {hasRecords ? `${row.original.attendanceRatePct}%` : "—"}
            </span>
          );
        },
      },
      {
        id: "risk",
        accessorFn: (row) => row.riskLevel,
        header: "Risk",
        size: 140,
        minSize: 140,
        maxSize: 140,
        cell: ({ row }) => <RiskBadge level={row.original.riskLevel} />,
      },
    ],
    [gradeMode],
  );

  const table = useReactTable({
    data: section.students,
    columns,
    getRowId: (row) => row.studentId,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    initialState: { pagination: { pageSize: 20 } },
    state: { sorting, columnFilters },
  });

  return (
    <section aria-label={`Students of ${section.section}`} className="flex min-w-0 flex-col gap-3">
      <div className={assign.card}>
        <span className={assign.glowClip} aria-hidden="true">
          <span className={assign.cardGlow} />
        </span>
        <div className="relative flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className={styles.sectionTitle}>
              {section.section} · {section.grade}
            </h2>
            <p className={styles.sectionDesc}>
              Averages compute live across all subjects — {section.students.length} student
              {section.students.length === 1 ? "" : "s"}.
            </p>
          </div>
          <InputGroup className="max-w-40 shrink-0">
            <InputGroupInput
              placeholder="Filter students..."
              value={(table.getColumn("name")?.getFilterValue() as string) ?? ""}
              onChange={(event) =>
                table.getColumn("name")?.setFilterValue(event.target.value)
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
                    {section.students.length === 0
                      ? "No students enrolled in this section."
                      : "No students match your search."}
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
        </div>
        <div className="relative">
          <Badge variant="secondary">{section.students.length} enrolled</Badge>
        </div>
      </div>
    </section>
  );
}
