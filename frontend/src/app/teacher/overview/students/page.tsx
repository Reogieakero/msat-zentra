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
import { useTopbarCrumb } from "@/app/teacher/layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollDownHint } from "@/components/ui/scroll-down-hint";
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
import emptyStyles from "@/app/teacher/schedule/schedule-empty.module.css";
import { sectionInitials } from "@/components/schedule/SectionScheduleCard";
import { useStudentList, type ClassPick, type StudentListRow } from "./components/student-list-data";
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

/** "Grade 7" (overview label) or "G7" (raw code) → "7" for the card badge. */
function gradeNumber(gradeLevel: string): string {
  const m = gradeLevel.match(/(\d+)/);
  return m ? m[1] : gradeLevel.replace(/^G/i, "");
}

/* Student List: the handled subject × section picker is a card rail on the
   right; the selected section's students render as a data table (name + LRN,
   attendance %, academic grade) in the main column. */
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

  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [sectionQuery, setSectionQuery] = React.useState("");
  // Scroll containers for the table rows and the section rail: native
  // scrolling with hidden scrollbars — a floating scroll-down hint (not a
  // scrollbar) tells the user there is more below. Declared before any
  // early return so the hooks stay unconditional.
  const tableScrollRef = React.useRef<HTMLDivElement | null>(null);
  const railScrollRef = React.useRef<HTMLDivElement | null>(null);

  // Unified rail cards: advised sections first, then handled subjects —
  // one template renders both, so advisers get the same display.
  const railCards = React.useMemo(
    () => {
      const items: {
        pick: ClassPick;
        titleLabel: string;
        title: string;
        middleName: string;
        middleSub: string;
        badgeGrade: string;
        ariaLabel: string;
        haystack: string;
      }[] = [
        ...advisorySections.map((s) => ({
          pick: { kind: "advisory", id: s.id } as ClassPick,
          titleLabel: "Advisory",
          title: s.name,
          middleName: s.gradeLevel,
          middleSub: `${s.studentCount} advisee${s.studentCount === 1 ? "" : "s"}`,
          badgeGrade: s.gradeLevel,
          ariaLabel: `Show advisees of ${s.name}`,
          haystack: `advisory ${s.name} ${s.gradeLevel}`.toLowerCase(),
        })),
        ...classes.map((c) => ({
          pick: { kind: "class", id: c.id } as ClassPick,
          titleLabel: "Subject",
          title: c.subject,
          middleName: `${c.section} (${c.gradeLevel})`,
          middleSub: `${c.studentCount} student${c.studentCount === 1 ? "" : "s"}`,
          badgeGrade: c.gradeLevel,
          ariaLabel: `Show students for ${c.subject} in ${c.section}`,
          haystack: `${c.subject} ${c.section} ${c.gradeLevel}`.toLowerCase(),
        })),
      ];
      const q = sectionQuery.trim().toLowerCase();
      return q ? items.filter((i) => i.haystack.includes(q)) : items;
    },
    [advisorySections, classes, sectionQuery],
  );

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
    initialState: { pagination: { pageSize: 10 } },
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

  if (roster.isPending) {
    return (
      <section className={styles.page} aria-busy="true" aria-label="Loading student list">
        <div className={styles.heading}>
          <h1>Student List</h1>
          <p>Loading your handled subjects…</p>
        </div>
        <div className={styles.skeleton} />
        <div className={styles.skeleton} />
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
                <div ref={tableScrollRef} className={styles.tableScroll}>
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
            <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center bg-gradient-to-t from-background via-background/85 to-transparent pt-6 pb-1">
                  <ScrollDownHint
                    scrollRef={tableScrollRef}
                    watchKey={`${activePick ? `${activePick.kind}:${activePick.id}` : ""}:${table.getFilteredRowModel().rows.length}`}
                    label="Scroll for more students"
                    className="pointer-events-auto rounded-full border border-border bg-card px-3 py-1 shadow-sm"
                  />
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

        {/* Right rail: one separate section card per advised section and
            handled subject × section — the same glow-card anatomy as
            /teacher/attendance (grade badge, avatar + title, middle block,
            hint, green selected ring). No schedule-status dot: this
            surface has no slot status to report, so nothing is faked. */}
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
              <div className="flex flex-col gap-3 pb-1">
              {railCards.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No sections match your search.
                </p>
              ) : (
                railCards.map((card) => {
              const active =
                !!activePick &&
                activePick.kind === card.pick.kind &&
                activePick.id === card.pick.id;
              return (
                <button
                  key={`${card.pick.kind}:${card.pick.id}`}
                  type="button"
                  onClick={() => handleSelect(card.pick)}
                  aria-pressed={active}
                  aria-label={card.ariaLabel}
                  className={`${assign.card} ${emptyStyles.pickOption} ${active ? emptyStyles.pickSelectedGreen : ""}`}
                >
                  <span className={assign.glowClip} aria-hidden="true">
                    <span className={assign.cardGlow} />
                  </span>
                  <Badge
                    variant="secondary"
                    className={`${assign.gradeBadge} ${assign.gradeFloat}`}
                    style={{
                      backgroundColor: "var(--primary)",
                      color: "var(--primary-foreground)",
                      borderColor: "transparent",
                    }}
                  >
                    Grade {gradeNumber(card.badgeGrade)}
                  </Badge>
                  <span className={assign.cardHead}>
                    <span className={assign.avatar} aria-hidden="true">
                      {sectionInitials(card.title)}
                    </span>
                    <span className={assign.cardTitleBlock}>
                      <span className={assign.fieldLabel}>{card.titleLabel}</span>
                      <span className={assign.itemName} title={card.title}>
                        {card.title}
                      </span>
                    </span>
                  </span>
                  <span className={assign.teacherBlock}>
                    <span className={assign.itemName} title={card.middleName}>
                      {card.middleName}
                    </span>
                    <span className={assign.itemTerm}>{card.middleSub}</span>
                  </span>
                  <span className={assign.itemTerm}>Tap to view student list</span>
                </button>
              );
              })
            )}
              </div>
            </div>
            <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center bg-gradient-to-t from-card via-card/85 to-transparent pt-6 pb-1">
              <ScrollDownHint
                scrollRef={railScrollRef}
                watchKey={`${railCards.length}:${sectionQuery}`}
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
