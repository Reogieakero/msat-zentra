"use client";

import * as React from "react";
import Link from "next/link";
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
import { BookOpen, Loader2, SearchIcon, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { InputGroup, InputGroupInput, InputGroupAddon } from "@/components/ui/input-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TeacherEmptyCard } from "../../components/TeacherEmptyCard";
import { Pagination } from "@/components/shared/pagination";
import { PAGE_SIZE } from "@/components/shared/pagination";
import { useAdvisoryRoster } from "@/services/teacher/advisory.service";
import type { AdviseeRow } from "@/services/teacher/advisory.types";
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";
import listStyles from "../list/components/advisory-list.module.css";
import {
  AdvisoryGradesBoard,
  generalAverageOf,
} from "./components/AdvisoryGradesBoard";
import { StudentMascot } from "../referrals/components/StudentMascot";

export default function TeacherAdvisoryStudentsPage() {
  const rosterQuery = useAdvisoryRoster();
  const searchParams = useSearchParams();
  const highlightId = searchParams.get("highlight");

  const students = React.useMemo(
    () => rosterQuery.data?.students ?? [],
    [rosterQuery.data],
  );
  const sections = React.useMemo(
    () => rosterQuery.data?.advisorySections ?? [],
    [rosterQuery.data],
  );
  const subjects = React.useMemo(
    () =>
      [...(rosterQuery.data?.subjects ?? [])].sort((a, b) =>
        a.name.localeCompare(b.name),
      ),
    [rosterQuery.data],
  );
  const sectionLabel = React.useMemo(
    () => sections.map((s) => s.name).join(", "),
    [sections],
  );

  const [sectionId, setSectionId] = React.useState<string>("all");
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  const filteredStudents = React.useMemo(() => {
    const inSection =
      sectionId === "all"
        ? students
        : students.filter((s) => {
            const sec = sections.find((x) => x.id === sectionId);
            return !sec || s.section === sec.name;
          });
    // Lowest general average first so at-risk students surface at the top.
    return [...inSection].sort((a, b) => {
      const av = generalAverageOf(a, subjects);
      const bv = generalAverageOf(b, subjects);
      if (av === null && bv === null) return a.name.localeCompare(b.name);
      if (av === null) return 1;
      if (bv === null) return -1;
      return av - bv;
    });
  }, [students, sections, sectionId, subjects]);

  // Keep a valid selection as the roster loads / changes.
  React.useEffect(() => {
    if (filteredStudents.length === 0) {
      setSelectedId(null);
      return;
    }
    setSelectedId((prev) =>
      prev && filteredStudents.some((s) => s.studentId === prev)
        ? prev
        : (highlightId &&
            filteredStudents.some((s) => s.studentId === highlightId)
            ? highlightId
            : filteredStudents[0]!.studentId),
    );
  }, [filteredStudents, highlightId]);

  const selectedStudent = React.useMemo(
    () => students.find((s) => s.studentId === selectedId) ?? null,
    [students, selectedId],
  );

  const columns = React.useMemo<ColumnDef<AdviseeRow>[]>(
    () => [
      {
        id: "name",
        accessorFn: (row) => `${row.name} ${row.lrn}`,
        header: "Student",
        size: 170,
        minSize: 150,
        maxSize: 200,
        cell: ({ row }) => (
          <div className="flex min-w-0 items-center gap-2">
            <StudentMascot
              name={row.original.name}
              seed={row.original.lrn}
              character={row.original.mascot ?? undefined}
              size={32}
            />
            <div className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-semibold text-primary">
                {row.original.name}
              </span>
              <span
                className="mt-1 inline-flex max-w-full shrink-0 items-center truncate rounded-md border border-border bg-secondary px-1.5 py-0.5 text-[11px] font-medium text-secondary-foreground"
                title={row.original.lrn}
              >
                {row.original.lrn}
              </span>
            </div>
          </div>
        ),
      },
      {
        id: "average",
        accessorFn: (row) => generalAverageOf(row, subjects) ?? -1,
        header: "Average",
        size: 100,
        minSize: 90,
        maxSize: 120,
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
            <span className="text-[13px] font-semibold tabular-nums" title="Mean of the student's graded live subject averages">
              {value.toFixed(1)}
            </span>
          );
        },
      },
    ],
    [subjects],
  );

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
    initialState: { pagination: { pageSize: PAGE_SIZE } },
    state: { sorting, columnFilters },
  });

  // Jump to the page containing the highlighted student (from advisory list).
  React.useEffect(() => {
    if (!highlightId) return;
    const idx = filteredStudents.findIndex((s) => s.studentId === highlightId);
    if (idx < 0) return;
    const pageSize = table.getState().pagination.pageSize;
    table.setPageIndex(Math.floor(idx / pageSize));
  }, [highlightId, filteredStudents, table]);

  // Scroll the highlighted row into view after pagination settles.
  const pageIndex = table.getState().pagination.pageIndex;
  React.useEffect(() => {
    if (!highlightId) return;
    const el = document.getElementById(`student-row-${CSS.escape(highlightId)}`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlightId, pageIndex, filteredStudents]);

  if (rosterQuery.isPending) {
    return (
      <section aria-label="Advisory students" className="flex min-w-0 flex-col gap-3">
        <div className={assign.card} aria-busy="true" aria-label="Loading advisory students" aria-hidden>
          <span className={assign.glowClip} aria-hidden="true">
            <span className={assign.cardGlow} />
          </span>
          <div className="relative flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="mt-1 h-4 w-52" />
            </div>
            <Skeleton className="h-9 w-40 shrink-0" />
          </div>
          <div className="relative overflow-x-auto rounded-md border">
            <div className="flex bg-muted/50" aria-hidden>
              <Skeleton className="m-2 h-4 rounded" style={{ width: 170 }} />
              <Skeleton className="m-2 h-4 rounded" style={{ width: 100 }} />
            </div>
            {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
              <div key={i} className="flex items-center gap-2 border-t px-3 py-2">
                <div className="flex min-w-0 flex-col gap-1.5" style={{ width: 170 }}>
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
                <Skeleton className="h-5 rounded-full" style={{ width: 100 }} />
              </div>
            ))}
          </div>
          <div className="relative flex items-center justify-end space-x-2">
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-8 w-20" />
          </div>
        </div>
      </section>
    );
  }

  if (rosterQuery.isError) {
    return (
      <section aria-label="Advisory students" className="flex min-w-0 flex-col gap-3">
        <TeacherEmptyCard
          centered
          icon={Users}
          title="No advisory section assigned"
          hint="No advisory section assigned, or it could not be loaded. Contact the school office."
          label="Advisory students"
          action={
            <Button variant="outline" size="sm" onClick={() => rosterQuery.refetch()} disabled={rosterQuery.isFetching}>
              {rosterQuery.isFetching ? (
                <>
                  <Loader2 size={16} className="animate-spin" aria-hidden />
                  <span aria-live="polite">Retrying</span>
                </>
              ) : (
                "Try again"
              )}
            </Button>
          }
        />
      </section>
    );
  }

  return (
    <section aria-label="Advisory students" className="flex min-w-0 flex-col gap-3">
      {students.length === 0 ? (
        <div className="flex min-h-[calc(100dvh-8rem)] w-full items-center justify-center">
          <div className={`${assign.card} w-full max-w-md`}>
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
              <p className="font-medium">No advisory students yet</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                Students enlisted in your advisory section will appear here with their live grades.
              </p>
              <Button asChild size="sm" className="mt-2">
                <Link href="/teacher/advisory/list">Add student</Link>
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className={listStyles.panel} aria-label="Advisory students board">
          <header className={listStyles.boardHead}>
            <span className={listStyles.boardIcon} aria-hidden>
              <BookOpen size={18} />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className={listStyles.boardTitle}>Advisory students</h2>
              <p className={listStyles.boardSub}>
                {`Click a row to inspect — ${filteredStudents.length} student${filteredStudents.length === 1 ? "" : "s"}${sectionLabel ? ` · ${sectionLabel}` : ""}.`}
              </p>
            </div>
          </header>

          <div className={listStyles.split}>
            <div className={listStyles.left}>
              <section className={listStyles.lane} aria-label="Advisory list lane">
                <header className={listStyles.laneHead}>
                  <span className={listStyles.laneDot} style={{ background: "#f59e0b" }} aria-hidden />
                  <h3 className={listStyles.laneTitle}>Advisory list</h3>
                  <span className={listStyles.laneCount}>
                    {table.getFilteredRowModel().rows.length}
                  </span>
                </header>
                <div className={listStyles.toolbar}>
                  <InputGroup className="w-32 min-w-0 flex-1 rounded-[16px]">
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
                  {sections.length > 1 ? (
                    <Select
                      value={sectionId}
                      onValueChange={(v) => {
                        setSectionId(v);
                        setSelectedId(null);
                      }}
                    >
                      <SelectTrigger className="w-36 shrink-0" aria-label="Section">
                        <SelectValue placeholder="All sections" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All sections</SelectItem>
                        {sections.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : null}
                </div>

                <div className={listStyles.tableWrap}>
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
                        table.getRowModel().rows.map((row) => {
                          const isSelected = row.original.studentId === selectedId;
                          const average = generalAverageOf(row.original, subjects);
                          return (
                            <TableRow
                              key={row.id}
                              id={`student-row-${row.original.studentId}`}
                              onClick={() => setSelectedId(row.original.studentId)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  setSelectedId(row.original.studentId);
                                }
                              }}
                              tabIndex={0}
                              aria-selected={isSelected}
                              aria-label={
                                average === null
                                  ? `${row.original.name}, no grades yet — open subject breakdown`
                                  : `${row.original.name}, general average ${average.toFixed(1)} — open subject breakdown`
                              }
                              className={`${listStyles.row} ${isSelected ? listStyles.selected : ""} ${highlightId === row.original.studentId ? "bg-primary/10" : ""}`}
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
                          );
                        })
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
                <Pagination
                  currentPage={table.getState().pagination.pageIndex + 1}
                  totalItems={table.getFilteredRowModel().rows.length}
                  onPageChange={(p) => table.setPageIndex(p - 1)}
                />
              </section>
            </div>
            <div className={listStyles.right} aria-label="Student grades">
              <AdvisoryGradesBoard
                student={selectedStudent}
                subjects={subjects}
                bare
              />
            </div>
          </div>
        </div>
      )}

    </section>
  );
}
