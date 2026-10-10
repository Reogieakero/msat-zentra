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
import { ChevronLeft, ChevronRight, SearchIcon, Users } from "lucide-react";
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
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";
import type { StudentListRow } from "@/services/teacher/studentList.types";
import styles from "./student-list.module.css";
function attendanceVariant(pct: number | null): "green" | "amber" | "red" | "outline" {
  if (pct === null) return "outline";
  if (pct >= 90) return "green";
  if (pct >= 80) return "amber";
  return "red";
}
function gradeVariant(grade: number | null): "green" | "blue" | "red" | "outline" {
  if (grade === null) return "outline";
  if (grade >= 90) return "green";
  if (grade >= 75) return "blue";
  return "red";
}
export function StudentTable({
  headerTitle,
  headerDesc,
  rows,
  rosterPending,
  rosterError,
  emptySectionName,
  activePickKey,
}: {
  headerTitle: React.ReactNode;
  headerDesc: string;
  rows: StudentListRow[];
  rosterPending: boolean;
  rosterError: boolean;
  emptySectionName: string;
  activePickKey: string;
}) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const columns = React.useMemo<ColumnDef<StudentListRow>[]>(
    () => [
      {
        id: "name",
        accessorFn: (row) => row.name,
        header: "Student",
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className={styles.cellMain}>{row.original.name}</p>
            <p className={styles.cellSub}>{row.original.lrn}</p>
          </div>
        ),
      },
      {
        id: "attendance",
        accessorFn: (row) => row.attendancePercentage ?? -1,
        header: "Attendance",
        cell: ({ row }) => {
          const pct = row.original.attendancePercentage;
          return (
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              <span>
                <Badge variant={attendanceVariant(pct)}>
                  {pct === null ? "No record" : `${pct}%`}
                </Badge>
              </span>
              <span>
                <Badge variant="outline">
                  {row.original.attendanceTotal > 0
                    ? `${row.original.attendancePresent}/${row.original.attendanceTotal} present`
                    : "No meetups yet"}
                </Badge>
              </span>
            </div>
          );
        },
      },
      {
        id: "grade",
        accessorFn: (row) => row.academicGrade ?? -1,
        header: "Academic Grade",
        cell: ({ row }) => {
          const grade = row.original.academicGrade;
          return (
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              <span>
                <Badge variant={gradeVariant(grade)}>
                  {grade === null ? "No grade" : grade}
                </Badge>
              </span>
              <span>
                <Badge variant="outline">
                  {row.original.computedAverage !== null
                    ? `Avg ${Math.round(row.original.computedAverage * 10) / 10}`
                    : "Not yet encoded"}
                </Badge>
              </span>
            </div>
          );
        },
      },
    ],
    [],
  );
  const table = useReactTable({
    data: rows,
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
  React.useEffect(() => {
    table.getColumn("name")?.setFilterValue("");
    table.setPageIndex(0);
  }, [activePickKey, table]);
  return (
    <div className={`${assign.card} ${styles.tableCard}`}>
      <span className={assign.glowClip} aria-hidden="true">
        <span className={assign.cardGlow} />
      </span>
      <div className="relative flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className={styles.sectionTitle}>
            {headerTitle}
          </h2>
          <p className={styles.sectionDesc}>
            {headerDesc}
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
      {rosterPending ? (
        <p className="relative text-sm text-muted-foreground" aria-busy="true">
          Loading students…
        </p>
      ) : rosterError ? (
        <p role="alert" className="relative text-sm text-destructive">
          Could not load students for this class.
        </p>
      ) : rows.length === 0 ? (
        <div className="relative flex flex-col items-center gap-2 py-6 text-center">
          <span
            className="flex h-12 w-12 items-center justify-center rounded-full bg-muted"
            aria-hidden="true"
          >
            <Users size={24} className="text-muted-foreground" />
          </span>
          <p className="font-medium">No students in this section yet</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Students will appear here once they are enlisted in{" "}
            {emptySectionName}.
          </p>
        </div>
      ) : (
        <>
          <div className={styles.tableScrollWrap}>
            <div className={styles.tableScroll}>
              <div className="overflow-x-auto rounded-md border">
                <Table className="w-full table-fixed">
                  <TableHeader>
                    {table.getHeaderGroups().map((headerGroup) => (
                      <TableRow
                        key={headerGroup.id}
                        className="bg-muted/50 [&>th]:border-t-0"
                      >
                        {headerGroup.headers.map((header) => (
                          <TableHead
                            key={header.id}
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
                            <TableCell key={cell.id} className="truncate">
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
            </div>
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
                  <ChevronLeft aria-hidden />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => table.nextPage()}
                  disabled={!table.getCanNextPage()}
                >
                  Next
                  <ChevronRight aria-hidden />
                </Button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
