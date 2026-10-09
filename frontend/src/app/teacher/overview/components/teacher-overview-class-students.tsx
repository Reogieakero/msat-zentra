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
import { StatusBadge } from "./teacher-overview-advisory";
import type { ClassStudentRow } from "@/services/teacher/overview.types";
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";
import styles from "./teacher-overview-advisory.module.css";

const FACTOR_BADGE: Record<string, { variant: "amber" | "green"; label: string }> = {
  academic: { variant: "amber", label: "Academic" },
  attendance: { variant: "green", label: "Attendance" },
};

function FactorBadges({ flags }: { flags?: ClassStudentRow["flags"] }) {
  const active = (flags ?? []).filter((f) => f in FACTOR_BADGE);
  if (active.length === 0) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {active.map((f) => (
        <Badge key={f} variant={FACTOR_BADGE[f].variant}>
          {FACTOR_BADGE[f].label}
        </Badge>
      ))}
    </span>
  );
}

interface TeacherOverviewClassStudentsProps {
  students: ClassStudentRow[];
  totalCount?: number;
}

export function TeacherOverviewClassStudents({ students, totalCount }: TeacherOverviewClassStudentsProps) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);

  const atRisk = React.useMemo(
    () => students.filter((s) => s.riskLevel !== "Low"),
    [students],
  );
  const total = totalCount ?? students.length;

  const columns = React.useMemo<ColumnDef<ClassStudentRow>[]>(
    () => [
      {
        id: "name",
        accessorFn: (row) => row.name,
        header: "Student",
        size: 200,
        minSize: 200,
        maxSize: 200,
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className={styles.cellMain}>{row.original.name}</p>
            <p className={styles.cellSub}>{row.original.lrn}</p>
          </div>
        ),
      },
      {
        id: "subjects",
        accessorFn: (row) => row.subjects.join(" "),
        header: "Subjects",
        size: 150,
        minSize: 150,
        maxSize: 150,
        cell: ({ row }) => {
          const codes = row.original.subjects.join(" · ");
          return codes ? (
            <span className="block truncate whitespace-nowrap font-mono text-xs" title={codes}>
              {codes}
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          );
        },
      },
      {
        id: "section",
        accessorFn: (row) => row.section,
        header: "Section",
        size: 110,
        minSize: 110,
        maxSize: 110,
        cell: ({ row }) => (
          <span className="truncate font-medium" title={row.original.section}>
            {row.original.section}
          </span>
        ),
      },
      {
        id: "riskLevel",
        accessorFn: (row) => row.riskLevel,
        header: "Status",
        size: 110,
        minSize: 110,
        maxSize: 110,
        cell: ({ row }) => <StatusBadge level={row.original.riskLevel} />,
      },
      {
        id: "factor",
        accessorFn: (row) => row.flags.join(" "),
        header: "Factor",
        size: 160,
        minSize: 160,
        maxSize: 160,
        cell: ({ row }) => <FactorBadges flags={row.original.flags} />,
      },
    ],
    [],
  );

  const table = useReactTable({
    data: atRisk,
    columns,
    getRowId: (row) => `${row.sectionId}:${row.studentId}`,
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
    <section aria-label="My class students" className="flex min-w-0 flex-col gap-3">
      {atRisk.length === 0 ? (
        <div className={assign.card}>
          <span className={assign.glowClip} aria-hidden="true">
            <span className={assign.cardGlow} />
          </span>
          {total > 0 ? (
            <div className="relative">
              <h2 className={styles.sectionTitle}>My Class Students</h2>
              <p className={styles.sectionDesc}>
                At-risk in your class subject assignments — 0 students. Academic +
                attendance only.
              </p>
            </div>
          ) : null}
          <div className="relative flex flex-col items-center gap-2 py-6 text-center">
            <span
              className="flex h-12 w-12 items-center justify-center rounded-full bg-muted"
              aria-hidden="true"
            >
              <Users size={24} className="text-muted-foreground" />
            </span>
            <p className="font-medium">
              {total === 0 ? "No class students yet" : "No at-risk students"}
            </p>
            <p className="max-w-sm text-sm text-muted-foreground">
              {total === 0
                ? "Your students will appear here once subjects are assigned to your classes."
                : "Every student in your classes is currently Low — only Moderate and High statuses are listed here."}
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
              <h2 className={styles.sectionTitle}>My Class Students</h2>
              <p className={styles.sectionDesc}>
                At-risk in your class subject assignments — {atRisk.length} student
                {atRisk.length === 1 ? "" : "s"}. Academic + attendance only.
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
