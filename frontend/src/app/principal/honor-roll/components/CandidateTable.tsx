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
import { SearchIcon, Trophy } from "lucide-react";
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
import type { HonorRollCandidate } from "@/services/principal/honorRoll.types";
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";
import styles from "./CandidateTable.module.css";

interface Props {
  candidates: HonorRollCandidate[];
  grades: number[];
  activeGrade: string;
  onGradeChange: (grade: string) => void;
  loading?: boolean;
}

const PAGE_SIZE = 10;

// Descriptor band → badge color (same hue ramp as the risk tables:
// top band green, mid bands blue/amber, lowest red).
const BAND_VARIANT: Record<string, "green" | "blue" | "amber" | "red"> = {
  Advancing: "green",
  Benchmarking: "blue",
  Connecting: "amber",
  Developing: "red",
  Emerging: "red",
};

/* Honor awardees as a data table in the At-Risk Advisees pattern: glow-card
   shell, title + count, search on the right, fixed-width sortable columns,
   bordered table, pager footer. Grade tabs scope the list per grade level. */
export function CandidateTable({
  candidates,
  grades,
  activeGrade,
  onGradeChange,
  loading,
}: Props) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);

  // Fixed columns only: Student, Section, General Avg, Band. No per-subject
  // columns — the general average is the single basis of this table.
  const columns = React.useMemo<ColumnDef<HonorRollCandidate>[]>(
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
        id: "section",
        accessorFn: (row) => row.section,
        header: "Section",
        size: 150,
        minSize: 150,
        maxSize: 150,
      },
      {
        id: "average",
        accessorFn: (row) => row.overallAverage,
        header: "General Avg",
        size: 110,
        minSize: 110,
        maxSize: 110,
        cell: ({ row }) => (
          <span className={styles.cellSub}>{row.original.overallAverage.toFixed(1)}</span>
        ),
      },
      {
        id: "band",
        accessorFn: (row) => row.band,
        header: "Band",
        size: 140,
        minSize: 140,
        maxSize: 140,
        cell: ({ row }) => (
          <Badge variant={BAND_VARIANT[row.original.band] ?? "secondary"} className={styles.tierBadge}>
            {row.original.band}
          </Badge>
        ),
      },
    ],
    []
  );

  const table = useReactTable({
    data: candidates,
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

  return (
    <section aria-label="Honor roll candidates" className="flex min-w-0 flex-col gap-3">
      <div className={assign.card}>
        <span className={assign.glowClip} aria-hidden="true">
          <span className={assign.cardGlow} />
        </span>
        <div className="relative flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className={styles.headTitle}>
              Grade {activeGrade} — Academic Excellence
            </h2>
            <p className={styles.sectionDesc} aria-live="polite">
              {candidates.length === 0
                ? "No awardees this term."
                : `${candidates.length} awardee${candidates.length === 1 ? "" : "s"} — general average ≥ 90, no subject below 80.`}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
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
        </div>
        <div className="relative" role="tablist" aria-label="Grade level">
          <div className={styles.tabs}>
            {grades.map((g) => (
              <button
                key={g}
                type="button"
                role="tab"
                aria-selected={String(g) === activeGrade}
                className={`${styles.tab} ${
                  String(g) === activeGrade ? styles.tabActive : ""
                }`}
                onClick={() => onGradeChange(String(g))}
              >
                Grade {g}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="relative overflow-x-auto rounded-md border">
            <Table className="w-full table-fixed" aria-label="Loading honor roll">
              <TableHeader>
                <TableRow className="bg-muted/50 [&>th]:border-t-0">
                  {["Student", "Section", "General Avg", "Band"].map((h) => (
                    <TableHead key={h} className="h-10 whitespace-nowrap">
                      {h}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <div className={styles.skeletonRow} />
                    </TableCell>
                    <TableCell>
                      <div className={styles.skeletonRow} />
                    </TableCell>
                    <TableCell>
                      <div className={styles.skeletonRow} />
                    </TableCell>
                    <TableCell>
                      <div className={styles.skeletonRow} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : candidates.length === 0 ? (
          <div className="relative flex flex-col items-center gap-2 py-6 text-center">
            <span
              className="flex h-12 w-12 items-center justify-center rounded-full bg-muted"
              aria-hidden="true"
            >
              <Trophy size={24} className="text-muted-foreground" />
            </span>
            <p className="font-medium">No awardees this term</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Students with a live general average of 90+ and no subject below 80
              will appear here as scores are recorded.
            </p>
          </div>
        ) : (
          <>
            <div className="relative overflow-x-auto rounded-md border">
              <Table className="w-full table-fixed" aria-label="Honor roll candidates">
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
                {table.getFilteredRowModel().rows.length} awardee
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
          </>
        )}
      </div>
    </section>
  );
}
