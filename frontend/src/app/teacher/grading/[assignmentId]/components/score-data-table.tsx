"use client";
import * as React from "react";
import { getCoreRowModel, getFilteredRowModel, getPaginationRowModel, getSortedRowModel, useReactTable, flexRender, type ColumnDef, type SortingState } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ClassAssessment, ClassStudent } from "@/services/teacher/grading.types";
import { scoreOf } from "./score-input";
import styles from "./ScoreGrid.module.css";
export function ScoreDataTable({ assessment, students, drafts, nameFilter }: { assessment: ClassAssessment; students: ClassStudent[]; drafts: Record<string, string>; nameFilter: string }) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const columns = React.useMemo<ColumnDef<ClassStudent>[]>(
    () => [
      {
        id: "student",
        accessorFn: (row) => row.name,
        header: "Student",
        size: 220,
        minSize: 220,
        maxSize: 220,
        cell: ({ row }) => (<p className={styles.cellMain}>{row.original.name}</p>),
      },
      {
        id: "lrn",
        accessorFn: (row) => row.lrn,
        header: "LRN",
        size: 140,
        minSize: 140,
        maxSize: 140,
        cell: ({ row }) => (<span className={styles.lrnCell}>{row.original.lrn}</span>),
      },
      {
        id: "score",
        accessorFn: (row) => scoreOf(assessment, drafts, false, row.id).num ?? -1,
        header: `Score / ${assessment.maxScore}`,
        size: 130,
        minSize: 130,
        maxSize: 130,
        cell: ({ row }) => {
          const { text } = scoreOf(assessment, drafts, false, row.original.id);
          return (<span className={styles.scoreValue}>{text.trim() === "" ? "—" : text}</span>);
        },
      },
      {
        id: "pct",
        accessorFn: (row) => {
          const { num } = scoreOf(assessment, drafts, false, row.id);
          return num !== null && assessment.maxScore > 0 ? (num / assessment.maxScore) * 100 : -1;
        },
        header: "%",
        size: 100,
        minSize: 100,
        maxSize: 100,
        cell: ({ row }) => {
          const { num } = scoreOf(assessment, drafts, false, row.original.id);
          return (<span className={styles.scorePct}>{num !== null && assessment.maxScore > 0 ? `${((num / assessment.maxScore) * 100).toFixed(1)}%` : "—"}</span>);
        },
      },
    ],
    [assessment, drafts],
  );
  const columnFilters = React.useMemo(() => (nameFilter ? [{ id: "student", value: nameFilter }] : []), [nameFilter]);
  const table = useReactTable({
    data: students,
    columns,
    getRowId: (row) => row.id,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    initialState: { pagination: { pageSize: 15 } },
    state: { sorting, columnFilters },
  });
  if (students.length === 0) {
    return <p className={styles.empty}>No students in this section yet.</p>;
  }
  return (
    <div className="flex w-full min-w-0 flex-col gap-3">
      <div className="overflow-x-auto rounded-md border">
        <Table className="w-full table-fixed" aria-label={`Scores for ${assessment.title}`}>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="bg-muted/50 [&>th]:border-t-0">
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} style={{ width: header.getSize() }} onClick={header.column.getToggleSortingHandler()} className="h-10 cursor-pointer truncate whitespace-nowrap select-none">
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
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
                    <TableCell key={cell.id} style={{ width: cell.column.getSize() }} className="truncate">
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
      <div className="flex items-center justify-end gap-2">
        <div className="flex-1 text-sm text-muted-foreground">
          {table.getFilteredRowModel().rows.length} student{table.getFilteredRowModel().rows.length === 1 ? "" : "s"}
        </div>
        {table.getPageCount() > 1 && (
          <>
            <Button variant="outline" size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
              Previous
            </Button>
            <Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
              Next
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
