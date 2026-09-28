"use client";

import * as React from "react";
import Link from "next/link";
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
import { Info, SearchIcon, X } from "lucide-react";
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
import type {
  AdviseeRow,
  AdvisorySectionInfo,
} from "./advisory-students-data";
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";

export type GradeComputation = "computed" | "transmuted";

const COMPUTATION_LABELS: Record<GradeComputation, string> = {
  computed: "Raw computation",
  transmuted: "Final transmuted",
};

function gradeOf(
  student: AdviseeRow,
  subject: string,
  computation: GradeComputation,
): number | null {
  const g = student.grades.find((x) => x.subject === subject);
  if (!g) return null;
  return computation === "computed" ? g.computedAverage : g.transmutedGrade;
}

function riskBadge(level: AdviseeRow["riskLevel"]): {
  variant: "green" | "amber" | "red";
} {
  if (level === "High") return { variant: "red" };
  if (level === "Moderate") return { variant: "amber" };
  return { variant: "green" };
}

interface AdvisoryGradesTableProps {
  students: AdviseeRow[];
  sections: AdvisorySectionInfo[];
  offeredSubjects: { name: string; code: string }[];
}

// Roster-wide per-subject grades as a data-table5-style table: one row per
// advisee, one grade column per offered subject code. The dropdown switches
// every grade cell between raw computation and final transmuted.
export function AdvisoryGradesTable({ students, sections, offeredSubjects }: AdvisoryGradesTableProps) {
  const [computation, setComputation] = React.useState<GradeComputation>("transmuted");
  const [filter, setFilter] = React.useState("");
  const [sectionId, setSectionId] = React.useState<string>("all");
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [showLegend, setShowLegend] = React.useState(true);

  // Subject-code columns = offered subjects (assignments + timetable), so
  // headers render even before any grade is encoded. Ungraded cells read as
  // Not connected.
  const subjects = React.useMemo(
    () =>
      [...offeredSubjects].sort((a, b) => a.name.localeCompare(b.name)),
    [offeredSubjects],
  );

  const filteredStudents = React.useMemo(() => {
    const q = filter.trim().toLowerCase();
    return students.filter((s) => {
      if (sectionId !== "all") {
        const sec = sections.find((x) => x.id === sectionId);
        if (sec && s.section !== sec.name) return false;
      }
      if (q === "") return true;
      return s.name.toLowerCase().includes(q) || s.lrn.toLowerCase().includes(q);
    });
  }, [students, sections, sectionId, filter]);

  const columns = React.useMemo<ColumnDef<AdviseeRow>[]>(() => {
    const subjectColumns: ColumnDef<AdviseeRow>[] = subjects.map((s) => ({
      id: `subject:${s.name}`,
      accessorFn: (row) => gradeOf(row, s.name, computation) ?? -1,
      header: s.code,
      size: 96,
      minSize: 96,
      maxSize: 96,
      cell: ({ row }) => {
        const value = gradeOf(row.original, s.name, computation);
        if (value === null) {
          return (
            <Badge
              variant="outline"
              title={`${s.name}: no grade data shared by the subject teacher yet`}
              aria-label={`${s.name}: not connected`}
              className="px-2 py-1"
            >
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/50" aria-hidden="true" />
            </Badge>
          );
        }
        return (
          <span className="font-medium tabular-nums" title={s.name}>
            {computation === "computed" ? value.toFixed(1) : value.toFixed(0)}
          </span>
        );
      },
    }));
    const result: ColumnDef<AdviseeRow>[] = [
      {
        id: "student",
        accessorFn: (row) => row.name,
        header: "Student",
        size: 220,
        minSize: 220,
        maxSize: 220,
        cell: ({ row }) => (
          <div className="min-w-0">
            <Link
              href={`/teacher/advisory/students/${row.original.studentId}/academic`}
              className="block truncate font-medium text-primary underline-offset-4 hover:underline"
            >
              {row.original.name}
            </Link>
            <p className="truncate text-xs text-muted-foreground">{row.original.lrn}</p>
          </div>
        ),
      },
      {
        id: "risk",
        accessorFn: (row) => row.riskLevel,
        header: "Risk",
        size: 120,
        minSize: 120,
        maxSize: 120,
        cell: ({ row }) => {
          const badge = riskBadge(row.original.riskLevel);
          return (
            <Badge variant={badge.variant}>
              {row.original.riskLevel}
            </Badge>
          );
        },
      },
      ...subjectColumns,
    ];
    return result;
  }, [subjects, computation]);

  const table = useReactTable({
    data: filteredStudents,
    columns,
    getRowId: (row) => row.studentId,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    initialState: { pagination: { pageSize: 10 } },
    state: { sorting, columnFilters },
  });

  return (
    <>
    <div className={assign.card}>
      <span className={assign.glowClip} aria-hidden="true">
        <span className={assign.cardGlow} />
      </span>
      <div className="relative flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">Advisory Students</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {students.length === 1 ? "1 advisee" : `${students.length} advisees`}
            {sections.length > 0 ? ` · ${sections.map((s) => s.name).join(", ")}` : ""}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          <InputGroup className="max-w-40">
            <InputGroupInput
              placeholder="Filter students..."
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              aria-label="Filter students"
            />
            <InputGroupAddon>
              <SearchIcon />
            </InputGroupAddon>
          </InputGroup>
          <div className="flex items-center gap-1" role="group" aria-label="Grade computation">
            {(Object.keys(COMPUTATION_LABELS) as GradeComputation[]).map((c) => (
              <Button
                key={c}
                type="button"
                size="sm"
                variant={computation === c ? "default" : "ghost"}
                onClick={() => setComputation(c)}
              >
                {COMPUTATION_LABELS[c]}
              </Button>
            ))}
          </div>
          {sections.length > 1 ? (
            <div className="flex items-center gap-1" role="group" aria-label="Filter by section">
              <Button
                type="button"
                size="sm"
                variant={sectionId === "all" ? "default" : "ghost"}
                onClick={() => setSectionId("all")}
              >
                All
              </Button>
              {sections.map((s) => (
                <Button
                  key={s.id}
                  type="button"
                  size="sm"
                  variant={sectionId === s.id ? "default" : "ghost"}
                  onClick={() => setSectionId(s.id)}
                >
                  {s.name}
                </Button>
              ))}
            </div>
          ) : null}
        </div>
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
                      title={
                        header.column.id.startsWith("subject:")
                          ? (subjects.find((s) => `subject:${s.name}` === header.column.id)?.name ??
                            header.column.id)
                          : undefined
                      }
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
                      ? "No students in your advisory yet."
                      : "No students match your search."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
      </div>
      <div className="relative flex items-center justify-end gap-2">
        <div className="flex-1 text-sm text-muted-foreground">
          {table.getFilteredRowModel().rows.length} student
          {table.getFilteredRowModel().rows.length === 1 ? "" : "s"} ·{" "}
          {COMPUTATION_LABELS[computation]}
        </div>
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

      {showLegend ? (
        <div
          role="note"
          aria-label="Dot legend"
          className="fixed right-4 bottom-4 z-40 w-60 rounded-xl border border-input bg-card p-3 shadow-lg"
        >
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold">Legend</p>
            <button
              type="button"
              onClick={() => setShowLegend(false)}
              aria-label="Dismiss legend"
              className="rounded-md p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X size={14} aria-hidden="true" />
            </button>
          </div>
          <div className="flex flex-col gap-1.5 text-xs">
            <span className="flex items-center gap-2">
              <Badge variant="green">Low</Badge>
              Low risk
            </span>
            <span className="flex items-center gap-2">
              <Badge variant="amber">Moderate</Badge>
              Moderate risk
            </span>
            <span className="flex items-center gap-2">
              <Badge variant="red">High</Badge>
              High risk
            </span>
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 shrink-0 rounded-full bg-muted-foreground/50" aria-hidden="true" />
              Not connected — no grade data from the subject teacher yet
            </span>
            <span className="flex items-center gap-2">
              <span className="font-semibold tabular-nums" aria-hidden="true">
                95
              </span>
              Connected — grade in the selected computation
            </span>
          </div>
        </div>
      ) : (
        <Button
          type="button"
          size="icon"
          onClick={() => setShowLegend(true)}
          aria-label="Open legend"
          title="Open legend"
          className="fixed right-4 bottom-4 z-40 rounded-full shadow-lg"
        >
          <Info size={18} aria-hidden="true" />
        </Button>
      )}
    </>
  );
}
