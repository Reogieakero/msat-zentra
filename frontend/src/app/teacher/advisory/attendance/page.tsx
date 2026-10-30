"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
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
import { CalendarClock, Loader2, SearchIcon, Users } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { useTerm } from "@/lib/term/TermContext";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { InsightCallout } from "@/components/ui/insight-callout";
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
import { Pagination } from "@/components/shared/pagination";
import { PAGE_SIZE } from "@/components/shared/pagination";
import { useAdvisoryRoster } from "@/services/teacher/advisory.service";
import { compareSurnameFirst, formatSurnameFirst } from "@/lib/names";
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";
import listStyles from "../list/components/advisory-list.module.css";
import {
  AdvisoryAttendanceBoard,
  attendanceOverall,
  attendanceRateClass,
  type AttendanceMatrixStudent,
  type AttendanceMatrixSubject,
} from "./components/AdvisoryAttendanceBoard";
import { StudentMascot } from "../referrals/components/StudentMascot";

interface SectionSubjectMatrix {
  sectionId: string;
  sectionName: string;
  termId: string;
  subjects: AttendanceMatrixSubject[];
  students: AttendanceMatrixStudent[];
}

interface AttendanceRow {
  student: AttendanceMatrixStudent;
  avg: number;
}

export default function AdvisoryAttendancePage() {
  const rosterQuery = useAdvisoryRoster();
  const { activeTerm } = useTerm();
  const termKey = `${activeTerm?.schoolYearId ?? ""}:${activeTerm?.termId ?? ""}`;

  const sections = React.useMemo(
    () => rosterQuery.data?.advisorySections ?? [],
    [rosterQuery.data],
  );
  const [sectionId, setSectionId] = React.useState<string | undefined>(undefined);
  const resolvedSectionId = sectionId ?? sections[0]?.id;

  const matrixQuery = useQuery<SectionSubjectMatrix>({
    queryKey: ["attendance-section-matrix", resolvedSectionId, termKey],
    queryFn: async () => {
      const params = new URLSearchParams({ sectionId: resolvedSectionId as string });
      const { data } = await apiClient.get<SectionSubjectMatrix>(
        `/api/attendance/section-subject-matrix?${params.toString()}`,
      );
      return data;
    },
    enabled: !!resolvedSectionId,
    retry: false,
  });

  const subjects = React.useMemo(
    () => matrixQuery.data?.subjects ?? [],
    [matrixQuery.data],
  );
  const students = React.useMemo(
    () => matrixQuery.data?.students ?? [],
    [matrixQuery.data],
  );
  const sectionLabel = React.useMemo(
    () => matrixQuery.data?.sectionName ?? sections.map((s) => s.name).join(", "),
    [matrixQuery.data, sections],
  );

  // Alphabetical by surname so the roster reads like the class record.
  const rows = React.useMemo<AttendanceRow[]>(
    () =>
      students
        .map((student) => ({
          student,
          avg: attendanceOverall(student.rates, subjects.length),
        }))
        .sort((a, b) => compareSurnameFirst(a.student.name, b.student.name)),
    [students, subjects.length],
  );

  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  // Keep a valid selection as the section data loads / changes.
  React.useEffect(() => {
    if (rows.length === 0) {
      setSelectedId(null);
      return;
    }
    setSelectedId((prev) =>
      prev && rows.some((r) => r.student.studentId === prev)
        ? prev
        : rows[0]!.student.studentId,
    );
  }, [rows]);

  const selectedStudent = React.useMemo(
    () => students.find((s) => s.studentId === selectedId) ?? null,
    [students, selectedId],
  );

  const columns = React.useMemo<ColumnDef<AttendanceRow>[]>(
    () => [
      {
        id: "name",
        accessorFn: (row) => `${formatSurnameFirst(row.student.name)} ${row.student.lrn}`,
        header: "Student",
        size: 170,
        minSize: 150,
        maxSize: 200,
        cell: ({ row }) => (
          <div className="flex min-w-0 items-center gap-2">
            <StudentMascot
              name={row.original.student.name}
              seed={row.original.student.lrn}
              character={row.original.student.mascot ?? undefined}
              size={32}
            />
            <div className="min-w-0 flex-1">
              <span
                className="block truncate text-[13px] font-semibold text-primary"
                title={row.original.student.name}
              >
                {formatSurnameFirst(row.original.student.name)}
              </span>
              <span
                className="mt-1 inline-flex max-w-full shrink-0 items-center truncate rounded-md border border-border bg-secondary px-1.5 py-0.5 text-[11px] font-medium text-secondary-foreground"
                title={row.original.student.lrn}
              >
                {row.original.student.lrn}
              </span>
            </div>
          </div>
        ),
      },
      {
        id: "rate",
        accessorFn: (row) => row.avg,
        header: "Present",
        size: 100,
        minSize: 90,
        maxSize: 120,
        cell: ({ row }) => (
          <span
            className={`text-[13px] font-semibold tabular-nums ${attendanceRateClass(row.original.avg)}`}
          >
            {`${Math.round(row.original.avg * 100)}%`}
          </span>
        ),
      },
    ],
    [],
  );

  const table = useReactTable({
    data: rows,
    columns,
    getRowId: (row) => row.student.studentId,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    initialState: { pagination: { pageSize: PAGE_SIZE } },
    state: { sorting, columnFilters },
  });

  const loading = rosterQuery.isPending || matrixQuery.isPending;

  if (loading) {
    return (
      <section aria-label="Advisory attendance" className="flex min-w-0 flex-col gap-3">
        <div className={assign.card} aria-busy="true" aria-label="Loading advisory attendance" aria-hidden>
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

  if (rosterQuery.isError || sections.length === 0) {
    return (
      <section aria-label="Advisory attendance" className="flex min-w-0 flex-col gap-3">
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
              <p className="font-medium">No advisory section</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                Advisory attendance appears here once a section is assigned to you.
              </p>
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (matrixQuery.isError) {
    return (
      <section aria-label="Advisory attendance" className="flex min-w-0 flex-col gap-3">
        <div className={assign.card}>
          <span className={assign.glowClip} aria-hidden="true">
            <span className={assign.cardGlow} />
          </span>
          <div className="relative flex flex-col items-center gap-2 py-6 text-center">
            <p role="alert" className="font-medium">
              Could not load advisory attendance.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => matrixQuery.refetch()}
              disabled={matrixQuery.isFetching}
            >
              {matrixQuery.isFetching ? (
                <>
                  <Loader2 size={16} className="animate-spin" aria-hidden />
                  <span aria-live="polite">Retrying</span>
                </>
              ) : (
                "Try again"
              )}
            </Button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section aria-label="Advisory attendance" className="flex min-w-0 flex-col gap-3">
      {rows.length === 0 ? (
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
              <p className="font-medium">No students in this section yet</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                Students will appear here once enrolled in this advisory section.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className={listStyles.panel} aria-label="Advisory attendance board">
          <header className={listStyles.boardHead}>
            <span className={listStyles.boardIcon} aria-hidden>
              <CalendarClock size={18} />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className={listStyles.boardTitle}>Advisory attendance</h2>
              <p className={listStyles.boardSub}>
                {`Click a row to inspect — ${rows.length} student${rows.length === 1 ? "" : "s"}${sectionLabel ? ` · ${sectionLabel}` : ""}.`}
              </p>
            </div>
          </header>

          <div className={listStyles.split}>
            <div className={listStyles.left}>
              <section className={listStyles.lane} aria-label="Advisory list lane">
                <header className={listStyles.laneHead}>
                  <span className={listStyles.laneDot} style={{ background: "#f59e0b" }} aria-hidden />
                  <h3 className={listStyles.laneTitle}>Advisory list</h3>
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
                      value={resolvedSectionId ?? ""}
                      onValueChange={(v) => {
                        setSectionId(v);
                        setSelectedId(null);
                      }}
                    >
                      <SelectTrigger className="w-36 shrink-0" aria-label="Section">
                        <SelectValue placeholder="Select a section" />
                      </SelectTrigger>
                      <SelectContent>
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
                          const isSelected =
                            row.original.student.studentId === selectedId;
                          const pct = Math.round(row.original.avg * 100);
                          return (
                            <TableRow
                              key={row.id}
                              onClick={() => setSelectedId(row.original.student.studentId)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  setSelectedId(row.original.student.studentId);
                                }
                              }}
                              tabIndex={0}
                              aria-selected={isSelected}
                              aria-label={`${row.original.student.name}, ${pct} percent present — open subject breakdown`}
                              className={`${listStyles.row} ${isSelected ? listStyles.selected : ""}`}
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
                        <TableRow className="hover:bg-transparent">
                          <TableCell colSpan={columns.length} className="h-40 whitespace-normal">
                            <div className="flex w-full justify-center">
                              <InsightCallout role="status" className="w-full max-w-xl text-left">
                                <strong>No students match your search.</strong> Try a different
                                name or LRN — or clear the filter to see every advisee.
                              </InsightCallout>
                            </div>
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
            <div className={listStyles.right} aria-label="Student attendance">
              <AdvisoryAttendanceBoard
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
