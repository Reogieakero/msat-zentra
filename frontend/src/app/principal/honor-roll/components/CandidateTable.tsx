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
import { PrincipalEmptyState } from "../../components/PrincipalEmptyCard";
import { Pill, type PillTone } from "@/components/ui/pill";
import { InputGroup, InputGroupInput, InputGroupAddon } from "@/components/ui/input-group";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { KanbanBoard } from "@/components/ui/kanban-board";
import type { HonorRollCandidate } from "@/services/principal/honorRoll.types";
import styles from "./CandidateTable.module.css";
import { PAGE_SIZE, Pagination } from "@/components/shared/pagination";

interface Props {
  candidates: HonorRollCandidate[];
  grades: number[];
  activeGrade: string;
  onGradeChange: (grade: string) => void;
  loading?: boolean;
}

const BAND_VARIANT: Record<string, PillTone> = {
  Advancing: "green",
  Benchmarking: "blue",
  Connecting: "amber",
  Developing: "red",
  Emerging: "red",
};

export function CandidateTable({
  candidates,
  grades,
  activeGrade,
  onGradeChange,
  loading,
}: Props) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);

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
          <Pill
            tone={BAND_VARIANT[row.original.band] ?? "neutral"}
            label="Descriptor band"
            className={styles.tierBadge}
          >
            {row.original.band}
          </Pill>
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
    <KanbanBoard
      title={`Grade ${activeGrade} — Academic Excellence`}
      icon={
        <span className="text-amber-600 dark:text-amber-400" aria-hidden="true">
          <Trophy size={14} />
        </span>
      }
      count={candidates.length}
      description={
        candidates.length === 0
          ? "No awardees this term."
          : `${candidates.length} awardee${candidates.length === 1 ? "" : "s"} — general average ≥ 90, no subject below 80.`
      }
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
      toolbar={
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
      }
      footer={
        <Pagination
          currentPage={table.getState().pagination.pageIndex + 1}
          totalItems={table.getFilteredRowModel().rows.length}
          onPageChange={(p) => table.setPageIndex(p - 1)}
        />
      }
    >
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
          <PrincipalEmptyState
            icon={Trophy}
            title="No awardees this term"
            hint="Students with a live general average of 90+ and no subject below 80 will appear here as scores are recorded."
          />
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
          </>
        )}
    </KanbanBoard>
  );
}
