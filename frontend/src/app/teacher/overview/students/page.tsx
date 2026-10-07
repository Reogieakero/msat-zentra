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
import { BookOpen, SearchIcon, Users } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useTopbarCrumb } from "@/app/teacher/layout";
import { useSession } from "@/lib/auth/useSession";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollDownHint } from "@/components/ui/scroll-down-hint";
import { Skeleton } from "@/components/ui/skeleton";
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
import BranchedMenu from "@/components/nav/BranchedMenu";
import {
  fetchStudentList,
  studentListKey,
  useStudentList,
} from "@/services/teacher/studentList.service";
import type {
  ClassPick,
  StudentListRow,
} from "@/services/teacher/studentList.types";
import styles from "./components/student-list.module.css";

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

/* Student List: the section picker is a branched nav rail on the right
   (same BranchedMenu design as the left sidebar links); the selected
   section's students render as a data table (name + LRN, attendance %,
   academic grade) in the main column. */
export default function TeacherStudentListPage() {
  const crumb = React.useMemo(
    () => (
      <span className="text-sm">
        <span className="text-muted-foreground">Overview</span>
        <span className="text-muted-foreground"> / </span>
        <span className="font-medium">Student List</span>
      </span>
    ),
    [],
  );
  useTopbarCrumb(crumb);

  // Sidebar-only: rail pins 16px below the lone topbar (4rem).
  // Single request renders rails + roster — the page never waits on the
  // heavier overview payload, so there is no overview → roster waterfall.
  // Explicit pick only; otherwise the first rail card is active (advisory
  // sections lead for advisers, handled classes otherwise). No effect
  // needed: deriving the default keeps selection stable across refetches
  // without cascading renders.
  const [picked, setPicked] = React.useState<ClassPick | null>(null);
  const roster = useStudentList(picked);
  const classes = React.useMemo(() => roster.data?.classes ?? [], [roster.data]);
  const advisorySections = React.useMemo(
    () => roster.data?.advisorySections ?? [],
    [roster.data],
  );
  // Unified rail: advised sections first, then handled subject × sections.
  const rail = React.useMemo<ClassPick[]>(
    () => [
      ...advisorySections.map((s): ClassPick => ({ kind: "advisory", id: s.id })),
      ...classes.map((c): ClassPick => ({ kind: "class", id: c.id })),
    ],
    [advisorySections, classes],
  );
  const activePick =
    picked && rail.some((r) => r.kind === picked.kind && r.id === picked.id)
      ? picked
      : (rail[0] ?? null);
  const selectedClass =
    activePick?.kind === "class"
      ? (classes.find((c) => c.id === activePick.id) ?? null)
      : null;
  const selectedAdvisory =
    activePick?.kind === "advisory"
      ? (advisorySections.find((s) => s.id === activePick.id) ?? null)
      : null;

  // Warm the roster cache for every other rail pick while the browser is
  // idle, so section switches usually hit the local cache instead of the
  // network. Skips the active pick (already loaded) and re-runs only when
  // the rail membership changes.
  const queryClient = useQueryClient();
  const session = useSession();
  const teacherId = session?.sub ?? null;
  const prefetchedKey = React.useRef("");
  React.useEffect(() => {
    if (!roster.data || !teacherId || rail.length === 0) return;
    const key = rail.map((r) => `${r.kind}:${r.id}`).join(",");
    if (prefetchedKey.current === key) return;
    prefetchedKey.current = key;
    const run = () => {
      for (const r of rail) {
        if (activePick && r.kind === activePick.kind && r.id === activePick.id) continue;
        const pick = { kind: r.kind, id: r.id } as ClassPick;
        void queryClient.prefetchQuery({
          queryKey: studentListKey(teacherId, pick),
          queryFn: () => fetchStudentList(pick),
          staleTime: 30_000,
        });
      }
    };
    const idleWindow = window as unknown as {
      requestIdleCallback?: (cb: () => void) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    if (typeof idleWindow.requestIdleCallback === "function") {
      const id = idleWindow.requestIdleCallback(run);
      return () => idleWindow.cancelIdleCallback?.(id);
    }
    const t = window.setTimeout(run, 600);
    return () => window.clearTimeout(t);
  }, [rail, roster.data, teacherId, queryClient, activePick]);

  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [sectionQuery, setSectionQuery] = React.useState("");
  // Scroll containers for the table rows and the section rail: native
  // scrolling with hidden scrollbars. The rail keeps a slim floating
  // scroll-down hint (not a scrollbar) to signal more below; the data
  // table shows 15 rows per page with no hint pill. Declared before any
  // early return so the hooks stay unconditional.
  const railScrollRef = React.useRef<HTMLDivElement | null>(null);

  // Section rail groups for the branched nav (same design as the left
  // sidebar links): advised sections under "Advisory", handled subject ×
  // sections under "Subjects". Values double as ClassPick keys.
  const railGroups = React.useMemo(() => {
    const q = sectionQuery.trim().toLowerCase();
    const advisoryKids = advisorySections
      .filter((s) =>
        q ? `advisory ${s.name} ${s.gradeLevel}`.toLowerCase().includes(q) : true,
      )
      .map((s) => ({
        value: `advisory:${s.id}`,
        label: `${s.name} · ${s.studentCount}`,
        icon: <Users size={16} strokeWidth={1.8} aria-hidden="true" />,
      }));
    // Rail shows the subject code only; the section is appended solely
    // to disambiguate the same code taught in several sections.
    const codeCounts = new Map<string, number>();
    for (const c of classes) {
      codeCounts.set(c.code, (codeCounts.get(c.code) ?? 0) + 1);
    }
    const subjectKids = classes
      .filter((c) =>
        q
          ? `${c.code} ${c.subject} ${c.section} ${c.gradeLevel}`.toLowerCase().includes(q)
          : true,
      )
      .map((c) => ({
        value: `class:${c.id}`,
        label:
          (codeCounts.get(c.code) ?? 0) > 1 ? `${c.code} · ${c.section}` : c.code,
        icon: <BookOpen size={16} strokeWidth={1.8} aria-hidden="true" />,
      }));
    const groups: { label: string; children: typeof advisoryKids }[] = [];
    if (advisoryKids.length > 0) groups.push({ label: "Advisory", children: advisoryKids });
    if (subjectKids.length > 0) groups.push({ label: "Subjects", children: subjectKids });
    return groups;
  }, [advisorySections, classes, sectionQuery]);
  const railEmpty = railGroups.length === 0;
  const activeRailValue = activePick ? `${activePick.kind}:${activePick.id}` : "";

  const rows = React.useMemo(() => roster.data?.students ?? [], [roster.data]);

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

  const handleSelect = React.useCallback(
    (pick: ClassPick) => {
      setPicked(pick);
      // Fresh search + first page for the newly picked section — done in the
      // event handler (never in an effect) so no cascading render fires.
      table.getColumn("name")?.setFilterValue("");
      table.setPageIndex(0);
    },
    [table],
  );

  // Geometry-matched skeleton: same heading + rail grid (table card
  // with 3 columns — Student / Attendance / Academic Grade — plus the
  // branched-section rail) as the loaded list.
  if (roster.isPending) {
    return (
      <section className={`${styles.page} ${styles.pageRail}`} aria-busy="true" aria-label="Loading student list">
        <div className={styles.body}>
          <div className={styles.mainCol}>
            <div className={styles.heading} aria-hidden>
              <Skeleton className="h-7 w-36" />
              <Skeleton className="mt-1 h-4 w-72" />
            </div>
            <div className={`${assign.card} ${styles.tableCard}`} aria-hidden>
              <span className={assign.glowClip} aria-hidden="true">
                <span className={assign.cardGlow} />
              </span>
              <div className="relative flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <Skeleton className="h-6 w-44" />
                  <Skeleton className="mt-1 h-4 w-64" />
                </div>
                <Skeleton className="h-9 w-40 shrink-0" />
              </div>
              <div className="relative overflow-x-auto rounded-md border">
                <div className="flex bg-muted/50" aria-hidden>
                  <Skeleton className="m-2 h-4 flex-1 rounded" />
                  <Skeleton className="m-2 h-4 flex-1 rounded" />
                  <Skeleton className="m-2 h-4 flex-1 rounded" />
                </div>
                {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
                  <div key={i} className="flex items-center gap-2 border-t px-3 py-2">
                    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                      <Skeleton className="h-4 w-2/3" />
                      <Skeleton className="h-3 w-1/3" />
                    </div>
                    <div className="flex flex-1 gap-1.5">
                      <Skeleton className="h-5 w-16 rounded-full" />
                      <Skeleton className="h-5 w-28 rounded-full" />
                    </div>
                    <div className="flex flex-1 gap-1.5">
                      <Skeleton className="h-5 w-14 rounded-full" />
                      <Skeleton className="h-5 w-24 rounded-full" />
                    </div>
                  </div>
                ))}
              </div>
              <div className="relative flex items-center justify-end space-x-2">
                <Skeleton className="h-8 w-20" />
                <Skeleton className="h-8 w-20" />
              </div>
            </div>
          </div>
          <aside className={styles.sideCol} aria-label="Sections" aria-hidden>
            <Skeleton className="h-9 w-full shrink-0" />
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className={assign.card}>
                <Skeleton className="relative h-5 w-3/4" />
                <Skeleton className="relative mt-1 h-3 w-1/2" />
              </div>
            ))}
          </aside>
        </div>
      </section>
    );
  }

  if (!roster.data) {
    return (
      <section className={styles.page}>
        <div className={styles.heading}>
          <h1>Student List</h1>
          <p>Your handled subjects with their students, attendance, and grades.</p>
        </div>
        <p role="alert" className={styles.empty}>
          Could not load your student list.
        </p>
      </section>
    );
  }

  if (rail.length === 0) {
    return (
      <section className={styles.page}>
        <div className={styles.heading}>
          <h1>Student List</h1>
          <p>
            Advised sections and handled subject × sections — pick one to see
            its students with attendance percentage and academic grade.
          </p>
        </div>
        <div className={assign.card}>
          <span className={assign.glowClip} aria-hidden="true">
            <span className={assign.cardGlow} />
          </span>
          <div className="relative flex flex-col items-center gap-2 py-6 text-center">
            <span
              className="flex h-12 w-12 items-center justify-center rounded-full bg-muted"
              aria-hidden="true"
            >
              <BookOpen size={24} className="text-muted-foreground" />
            </span>
            <p className="font-medium">No students to list yet</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Your advised sections and handled subject × section cards will
              appear here once sections are assigned to you this term.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className={`${styles.page} ${styles.pageRail}`}>
    
      <div className={styles.body}>
        <div className={styles.mainCol}>
          <div className={styles.heading}>
            <h1>Student List</h1>
            <p>
              Pick a section card on the right to see its students with
              attendance percentage and academic grade.
            </p>
          </div>
          <div className={`${assign.card} ${styles.tableCard}`}>
            <span className={assign.glowClip} aria-hidden="true">
              <span className={assign.cardGlow} />
            </span>
            <div className="relative flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className={styles.sectionTitle}>
                  {roster.data?.advisorySection ? (
                    <>
                      {roster.data.advisorySection.name} · Advisory
                    </>
                  ) : (
                    <>
                      {roster.data?.class?.subjectName ?? selectedClass?.subject} ·{" "}
                      {roster.data?.class?.sectionName ?? selectedClass?.section}
                    </>
                  )}
                </h2>
                <p className={styles.sectionDesc}>
                  {roster.data
                    ? `${roster.data.students.length} student${roster.data.students.length === 1 ? "" : "s"} · ` +
                      (roster.data.advisorySection
                        ? "attendance + general average"
                        : "attendance + academic grade for this subject")
                    : "Loading students…"}
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

            {roster.isPending ? (
              <p className="relative text-sm text-muted-foreground" aria-busy="true">
                Loading students…
              </p>
            ) : roster.isError ? (
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
                  {roster.data?.class?.sectionName ??
                    roster.data?.advisorySection?.name ??
                    selectedClass?.section ??
                    selectedAdvisory?.name}.
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
        </div>

        {/* Right rail: branched section nav mirroring the left sidebar
            links (group labels + elbow tree + orange active link). */}
        <aside className={styles.sideCol} aria-label="Sections">
          <InputGroup className="w-full shrink-0">
            <InputGroupInput
              placeholder="Search sections..."
              value={sectionQuery}
              onChange={(event) => setSectionQuery(event.target.value)}
              aria-label="Search sections"
            />
            <InputGroupAddon>
              <SearchIcon />
            </InputGroupAddon>
          </InputGroup>
          <div className={styles.railScrollWrap}>
            <div ref={railScrollRef} className={styles.railScroll}>
              {railEmpty ? (
                <p className="text-sm text-muted-foreground">
                  No sections match your search.
                </p>
              ) : (
                <BranchedMenu
                  items={railGroups}
                  defaultOpen={[0, 1]}
                  defaultActive={activeRailValue}
                  activeValue={activeRailValue}
                  onSelect={(value) => {
                    const sep = value.indexOf(":");
                    if (sep < 0) return;
                    const kind = value.slice(0, sep);
                    const id = value.slice(sep + 1);
                    if (kind === "advisory" || kind === "class") {
                      handleSelect({ kind, id } as ClassPick);
                    }
                  }}
                  width={232}
                />
              )}
            </div>
            <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center px-3 pb-1.5 pt-6">
              <ScrollDownHint
                scrollRef={railScrollRef}
                watchKey={`${railGroups.length}:${sectionQuery}`}
                label="Scroll for more sections"
                className="pointer-events-auto rounded-full border border-border bg-card px-3 py-1 shadow-sm"
              />
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
