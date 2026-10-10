"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
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
import { ChevronLeft, ChevronRight, Info, SearchIcon, X } from "lucide-react";
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
} from "@/services/teacher/advisory.types";
import tableScroll from "./advisory-grades-table.module.css";
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";

function gradeOf(student: AdviseeRow, subject: string): number | null {
  const g = (student.liveGrades ?? []).find((x) => x.subject === subject);
  return g ? g.average : null;
}

function riskBadge(level: AdviseeRow["riskLevel"]): {
  variant: "green" | "amber" | "red";
} {
  if (level === "High") return { variant: "red" };
  if (level === "Moderate") return { variant: "amber" };
  return { variant: "green" };
}

function academicRiskOf(
  student: AdviseeRow,
  subjects: { name: string }[],
): "Low" | "Moderate" | null {
  const values: number[] = [];
  for (const s of subjects) {
    const v = gradeOf(student, s.name);
    if (v !== null) values.push(v);
  }
  if (values.length === 0) return null;
  const average = values.reduce((a, b) => a + b, 0) / values.length;
  return average < 75 ? "Moderate" : "Low";
}

function generalAverageOf(
  student: AdviseeRow,
  subjects: { name: string }[],
): number | null {
  const values: number[] = [];
  for (const s of subjects) {
    const v = gradeOf(student, s.name);
    if (v !== null) values.push(v);
  }
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

interface AdvisoryGradesTableProps {
  students: AdviseeRow[];
  sections: AdvisorySectionInfo[];
  offeredSubjects: { name: string; code: string }[];
}

export function AdvisoryGradesTable({ students, sections, offeredSubjects }: AdvisoryGradesTableProps) {
  const [sectionId, setSectionId] = React.useState<string>("all");
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [showLegend, setShowLegend] = React.useState(true);

  const subjects = React.useMemo(
    () =>
      [...offeredSubjects].sort((a, b) => a.name.localeCompare(b.name)),
    [offeredSubjects],
  );

  const filteredStudents = React.useMemo(() => {
    return students.filter((s) => {
      if (sectionId !== "all") {
        const sec = sections.find((x) => x.id === sectionId);
        if (sec && s.section !== sec.name) return false;
      }
      return true;
    });
  }, [students, sections, sectionId]);

  const columns = React.useMemo<ColumnDef<AdviseeRow>[]>(() => {
    const subjectColumns: ColumnDef<AdviseeRow>[] = subjects.map((s) => ({
      id: `subject:${s.name}`,
      accessorFn: (row) => gradeOf(row, s.name) ?? -1,
      header: s.code,
      size: 96,
      minSize: 96,
      maxSize: 96,
      cell: ({ row }) => {
        const value = gradeOf(row.original, s.name);
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
          <span className="font-medium tabular-nums" title={`${s.name}: live average of recorded scores`}>
            {value.toFixed(1)}
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
            <span className="block truncate text-[13px] font-semibold text-primary">
              {row.original.name}
            </span>
            <p className="truncate text-xs text-muted-foreground">{row.original.lrn}</p>
          </div>
        ),
      },
      {

        id: "risk",
        accessorFn: (row) => {
          const r = academicRiskOf(row, subjects);
          return r === null ? -1 : r === "Moderate" ? 1 : 0;
        },
        header: "Risk",
        size: 120,
        minSize: 120,
        maxSize: 120,
        cell: ({ row }) => {
          const r = academicRiskOf(row.original, subjects);
          if (r === null) {
            return (
              <span className="text-muted-foreground" title="No academic risk yet — no grade data shared">
                —
              </span>
            );
          }
          const badge = riskBadge(r);
          return <Badge variant={badge.variant}>{r}</Badge>;
        },
      },
      {

        id: "general-average",
        accessorFn: (row) => generalAverageOf(row, subjects) ?? -1,
        header: "General Average",
        size: 130,
        minSize: 130,
        maxSize: 130,
        cell: ({ row }) => {
          const value = generalAverageOf(row.original, subjects);
          if (value === null) {
            return (
              <span className="text-muted-foreground" title="No general average yet — no grade data shared">
                —
              </span>
            );
          }
          return (
            <span className="font-medium tabular-nums" title="Mean of the student's graded live subject averages">
              {value.toFixed(1)}
            </span>
          );
        },
      },
      ...subjectColumns,
    ];
    return result;
  }, [subjects]);

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
    initialState: { pagination: { pageSize: 15 } },
    state: { sorting, columnFilters },
  });

  const searchParams = useSearchParams();
  const highlightId = searchParams.get("highlight");

  // Jump to the page containing the highlighted student (from advisory list).
  React.useEffect(() => {
    if (!highlightId) return;
    const idx = filteredStudents.findIndex((s) => s.studentId === highlightId);
    if (idx < 0) return;
    const pageSize = table.getState().pagination.pageSize;
    table.setPageIndex(Math.floor(idx / pageSize));
  }, [highlightId, filteredStudents, table]);

  // Scroll the highlighted row into view after pagination settles.
  React.useEffect(() => {
    if (!highlightId) return;
    const el = document.getElementById(`student-row-${CSS.escape(highlightId)}`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlightId, table.getState().pagination.pageIndex, filteredStudents]);

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

      <div className={`relative rounded-md border ${tableScroll.tableScroll}`}>
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
                          : header.column.id === "general-average"
                            ? "Mean of the student's graded live subject averages"
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
                  <TableRow
                    key={row.id}
                    id={`student-row-${row.original.studentId}`}
                    className={
                      highlightId === row.original.studentId
                        ? "bg-primary/10 shadow-[inset_3px_0_0_var(--primary)]"
                        : undefined
                    }
                  >
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
            Live grades
          </div>
        {table.getPageCount() > 1 && (
          <>
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
          </>
        )}
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
              <span className="text-muted-foreground" aria-hidden="true">
                —
              </span>
              No academic risk yet — grades not connected
            </span>
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 shrink-0 rounded-full bg-muted-foreground/50" aria-hidden="true" />
              Not connected — no grade data from the subject teacher yet
            </span>
            <span className="flex items-center gap-2">
              <span className="font-semibold tabular-nums" aria-hidden="true">
                95
              </span>
              Connected — live average of recorded scores
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
