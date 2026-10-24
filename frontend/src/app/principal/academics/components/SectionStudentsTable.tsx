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
import { InputGroup, InputGroupInput, InputGroupAddon } from "@/components/ui/input-group";
import { PrincipalEmptyCard } from "../../components/PrincipalEmptyCard";
import { KanbanBoard } from "@/components/ui/kanban-board";
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
import styles from "./SectionStudentsTable.module.css";
import { PAGE_SIZE, Pagination } from "@/components/shared/pagination";

// Unified real-time: primary average is transmuted (final scale).
// General average across subjects that have a grade only — ungraded
// subjects never drag the average down.
function gradedValues(st: StudentRow, pick: (s: StudentRow["subjects"][number]) => unknown): number[] {
  return st.subjects
    .map(pick)
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
}

export function liveAverage(st: StudentRow): number | null {
  const vals = gradedValues(st, (s) => s.transmutedGrade);
  if (vals.length === 0) return null;
  return vals.reduce((sum, v) => sum + v, 0) / vals.length;
}

interface SectionStudentsTableProps {
  section: SectionSummary;
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

export function SectionStudentsTable({ section }: SectionStudentsTableProps) {
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
        accessorFn: (row) => liveAverage(row) ?? -1,
        header: "General Average",
        size: 120,
        minSize: 120,
        maxSize: 120,
        cell: ({ row }) => {
          const avg = liveAverage(row.original);
          if (avg === null) {
            return (
              <span
                className="text-muted-foreground tabular-nums"
                title="No general average yet — no graded subjects"
              >
                —
              </span>
            );
          }
          return (
            <span
              className={`font-medium tabular-nums ${toneClass(averageTone(avg))}`}
              title="Mean of the student's graded subject averages"
            >
              {avg.toFixed(1)}
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
    [],
  );

  const students = section.students ?? [];
  const table = useReactTable({
    data: students,
    columns,
    getRowId: (row) => row.studentId,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    initialState: { pagination: { pageSize: PAGE_SIZE } },
    state: { sorting, columnFilters },
  });

  if (students.length === 0) {
    return (
      <PrincipalEmptyCard
        icon={Users}
        title="No students enrolled"
        hint={`No students enrolled in ${section.section}. Enrolled students will appear here once added.`}
        label={`Students of ${section.section}`}
      />
    );
  }
  return (
    <KanbanBoard
      title={`${section.section} · ${section.grade}`}
      icon={<Users size={14} aria-hidden="true" />}
      count={students.length}
      description={`Averages compute live across all subjects — ${students.length} student${students.length === 1 ? "" : "s"}.`}
      actions={
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
      }
      footer={
        <Pagination
          currentPage={table.getState().pagination.pageIndex + 1}
          totalItems={table.getFilteredRowModel().rows.length}
          onPageChange={(p) => table.setPageIndex(p - 1)}
        />
      }
      ariaLabel={`Students of ${section.section}`}
    >
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
                    {students.length === 0
                      ? "No students enrolled in this section."
                      : "No students match your search."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
    </KanbanBoard>
  );
}
