"use client";
import * as React from "react";
import { useTeacherInvalidate } from "../../components/use-teacher-invalidate";
import {
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";
import { SearchIcon, Users } from "lucide-react";
import { StudentMascot } from "@/components/student-mascot/StudentMascot";
import { assignUniqueMascots } from "@/app/teacher/grading/[assignmentId]/components/mascot-assignment";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupInput, InputGroupAddon } from "@/components/ui/input-group";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/sonner";
import { useDock } from "@/components/dock/dock-store";
import { KanbanBoard, KanbanBoardEmpty } from "@/components/ui/kanban-board";
import { DropdownSelect } from "@/app/principal/academics/assign/components/DropdownSelect";
import dropdownStyles from "@/app/principal/academics/assign/components/dropdown-select.module.css";
import rowStyles from "@/components/ui/row-list.module.css";
import { useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/lib/auth/useSession";
import { useTerm } from "@/lib/term/TermContext";
import { MARKS_STALE_MS, DEFAULT_MEETUP_DAYS, fetchSheetMarks, phTodayKey, sheetMarksKey, submitSheet, useMeetupDates, useSheetMarks } from "@/services/teacher/attendance.service";
import { apiErrorMessage } from "@/lib/api/errors";
import type { SheetContext, SheetStatus } from "@/services/teacher/attendance.types";
import { MeetupBlocksCell, StatusBoxes } from "./status-boxes";
import { useRosterMarks } from "./use-roster-marks";
import { SaveAttendanceKanban } from "./save-attendance-dialog";
interface RosterRow {
  id: string;
  name: string;
  lrn: string;
  rate: number | null;
  status: SheetStatus | null;
  impliedAbsent?: boolean;
}
export interface AttendanceLive {
  locked: boolean;
  tone: "lock" | "info";
  message: string | null;
  nowMin: number;
  todayKey: string;
  todayEnd: number | null;
}
export interface BlocksInfo {
  dates: string[];
  statusOf: (id: string, date: string) => SheetStatus | null;
  pastDue: (date: string) => boolean;
  loading: boolean;
  hasTerm: boolean;
}
const DAY_RANK: Record<SheetStatus, number> = { present: 0, excused: 1, late: 2, absent: 3 };

const EMPTY_STUDENTS: SheetContext["students"] = [];
const EMPTY_MEETUP_DATES: string[] = [];

/* Row pills mirror the overview At-Risk RowList tones. */
const PILL_BASE =
  "inline-flex items-center rounded-md border px-1.5 py-0.5 text-[11px] font-medium";

const MARK_PILL: Record<SheetStatus, { label: string; tone: string }> = {
  present: { label: "Present", tone: "border-green-500 bg-green-500/10 text-green-600 dark:text-green-400" },
  absent: { label: "Absent", tone: "border-red-500 bg-red-500/10 text-red-600 dark:text-red-400" },
  late: { label: "Late", tone: "border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-400" },
  excused: { label: "Excused", tone: "border-blue-500 bg-blue-500/10 text-blue-700 dark:text-blue-400" },
};
const UNMARKED_PILL = "border-border bg-muted text-muted-foreground";

function ratePillTone(rate: number): string {
  if (rate >= 0.9) return "border-green-500 bg-green-500/10 text-green-700 dark:text-green-400";
  if (rate >= 0.75) return "border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-400";
  return "border-red-500 bg-red-500/10 text-red-700 dark:text-red-400";
}

function lastNameOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.length > 1 ? (parts[parts.length - 1] ?? "") : (parts[0] ?? "");
}

const SORT_OPTIONS = [
  { value: "name", label: "First name A–Z" },
  { value: "lastName", label: "Last name A–Z" },
  { value: "rate-desc", label: "Highest %" },
  { value: "rate-asc", label: "Lowest %" },
  { value: "status", label: "Status" },
];
interface AttendanceRosterTableProps {
  date: string;
  subjectId: string | undefined;
  assignmentId?: string;
  slot: number;
  roster?: { ctx: SheetContext | null; pending: boolean; error: boolean; requestedSectionId?: string | null };
  meetupDays?: number[];
  live: AttendanceLive;
  blocksMode: boolean;
  onBlocksModeChange: (value: boolean) => void;
}
export function AttendanceRosterTable({ date, subjectId, assignmentId, slot, roster, meetupDays = DEFAULT_MEETUP_DAYS as unknown as number[], live, blocksMode, onBlocksModeChange }: AttendanceRosterTableProps) {
  const invalidateTeacher = useTeacherInvalidate();
  const queryClient = useQueryClient();
  const session = useSession();
  const { activeTerm } = useTerm();
  const teacherId = session?.sub ?? null;
  const termKey = `${activeTerm?.schoolYearId ?? ""}:${activeTerm?.termId ?? ""}`;
  const sectionId = roster?.ctx?.sectionId ?? null;
  const hasSection = !!sectionId;
  const marksQuery = useSheetMarks(date, subjectId, slot, sectionId);
  // The parent rebuilds the roster wrapper per render — read through to the
  // stable query-backed students array so downstream memos stay settled.
  const students = roster?.ctx?.students ?? EMPTY_STUDENTS;
  // Unique mascot per student — same pool/assignment as the gradebook
  // encode + score views so sprites stay stable per student.
  const mascotById = React.useMemo(
    () =>
      assignUniqueMascots(
        students.map((s) => ({ id: s.studentId, name: s.name, lrn: s.lrn })),
      ),
    [students],
  );
  const serverMarks = React.useMemo(() => marksQuery.data ?? {}, [marksQuery.data]);
  const switchingSection = !!roster?.requestedSectionId && sectionId !== roster.requestedSectionId;
  // With keepPreviousData, switching subject/slot/date serves the previous
  // sheet as placeholder — treat that as loading so the skeleton shows
  // instead of flashing the wrong sheet's marks. Same-key background
  // revalidates (real data present, not placeholder) render normally.
  const marksLoading =
    (marksQuery.fetchStatus !== "idle" && marksQuery.isPending) || marksQuery.isPlaceholderData;
  const loading = switchingSection || (roster?.pending ?? false) || marksLoading;
  const loadError = (roster?.error ?? false) || (hasSection && marksQuery.isError);
  const sheetKey = `${date}|${sectionId ?? "none"}|${subjectId ?? "none"}|${slot}`;
  const { marks, setMarks, pick, merged } = useRosterMarks(sheetKey, serverMarks);
  const dock = useDock();
  const dockRef = React.useRef(dock);
  React.useEffect(() => {
    dockRef.current = dock;
  }, [dock]);
  const [saveOpen, setSaveOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const openSave = () => {
    if (live.locked) return;
    setSaveError(null);
    setSaveOpen(true);
  };
  const { days: subjectDays, dateKeys, isPending: meetupPending, hasTerm: hasMeetupTerm } = useMeetupDates(sectionId ?? undefined, subjectId, meetupDays);
  const meetupDates = dateKeys ?? EMPTY_MEETUP_DATES;
  // Prefetch prev/next meetup dates so picker hops render instantly from
  // cache. Skips entries that are already fresh; save-path invalidation
  // (attendance-sheet-marks prefix) clears these on submit.
  // meetupDates identity is memoized upstream — depend on a joined key so a
  // new array with the same dates can't retrigger prefetches every render.
  const meetupDatesKey = meetupDates.join("|");
  React.useEffect(() => {
    if (!teacherId || !subjectId || !sectionId || meetupDates.length === 0) return;
    const idx = meetupDates.indexOf(date);
    if (idx < 0) return;
    for (const neighbor of [meetupDates[idx - 1], meetupDates[idx + 1]]) {
      if (!neighbor) continue;
      const key = sheetMarksKey(teacherId, neighbor, subjectId, slot, sectionId, termKey);
      const state = queryClient.getQueryState(key);
      if (state && Date.now() - state.dataUpdatedAt < MARKS_STALE_MS) continue;
      void queryClient.prefetchQuery({
        queryKey: key,
        queryFn: () => fetchSheetMarks(`${neighbor}T00:00:00Z`, subjectId, slot, sectionId),
        staleTime: MARKS_STALE_MS,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryClient, teacherId, termKey, date, meetupDatesKey, subjectId, slot, sectionId]);
  const dayStatusByStudent = React.useMemo(() => {
    const map = new Map<string, Map<string, SheetStatus>>();
    for (const r of subjectDays?.records ?? []) {
      let m = map.get(r.key);
      if (!m) {
        m = new Map<string, SheetStatus>();
        map.set(r.key, m);
      }
      const prev = m.get(r.date);
      if (!prev || DAY_RANK[r.status] > DAY_RANK[prev]) m.set(r.date, r.status);
    }
    return map;
  }, [subjectDays]);
  const dayStatusOf = React.useCallback((id: string, day: string): SheetStatus | null => dayStatusByStudent.get(id)?.get(day) ?? null, [dayStatusByStudent]);
  const liveTodayKey = live.todayKey;
  const liveTodayEnd = live.todayEnd;
  const liveNowMin = live.nowMin;
  const blocksInfo = React.useMemo<BlocksInfo>(() => ({
    dates: meetupDates,
    statusOf: dayStatusOf,
    pastDue: (day: string) => day < liveTodayKey || (day === liveTodayKey && liveTodayEnd !== null && liveNowMin >= liveTodayEnd),
    loading: meetupPending,
    hasTerm: hasMeetupTerm,
  }), [meetupDates, dayStatusOf, meetupPending, hasMeetupTerm, liveTodayKey, liveTodayEnd, liveNowMin]);
  const data = React.useMemo<RosterRow[]>(() => {
    const elapsed = meetupDates.filter((d) => d <= live.todayKey);
    // Missing record means absent once the subject time is done: any past
    // meetup date, or today once today's class has ended.
    const sheetPastDue =
      date < live.todayKey ||
      (date === live.todayKey && live.todayEnd !== null && live.nowMin >= live.todayEnd);
    return students.map((s) => {
      const days = dayStatusByStudent.get(s.studentId);
      let present = 0;
      for (const d of elapsed) {
        if (days?.get(d) === "present") present += 1;
      }
      // Real saved status first; when nothing was ever recorded and the
      // meetup time has passed, display absent (implied, not saved).
      const saved = merged[s.studentId] ?? null;
      const impliedAbsent = saved === null && sheetPastDue;
      return { id: s.studentId, name: s.name, lrn: s.lrn, rate: elapsed.length === 0 ? null : present / elapsed.length, status: saved ?? (sheetPastDue ? "absent" : null), impliedAbsent };
    });
  }, [students, merged, meetupDates, dayStatusByStudent, live.todayKey, live.todayEnd, live.nowMin, date]);
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const columns = React.useMemo<ColumnDef<RosterRow>[]>(() => [
    { accessorKey: "name" },
    {
      id: "lastName",
      accessorKey: "name",
      sortingFn: (a, b) =>
        lastNameOf(a.original.name).localeCompare(lastNameOf(b.original.name), "en", {
          sensitivity: "base",
        }),
    },
    {
      accessorKey: "rate",
      sortingFn: (a, b) => (a.original.rate ?? -1) - (b.original.rate ?? -1),
    },
    { accessorKey: "status" },
  ], []);
  const sortValue =
    sorting.length === 0
      ? ""
      : sorting[0].id === "rate"
        ? sorting[0].desc
          ? "rate-desc"
          : "rate-asc"
        : sorting[0].id;
  const handleSortChange = (value: string) => {
    if (value === "rate-desc") setSorting([{ id: "rate", desc: true }]);
    else if (value === "rate-asc") setSorting([{ id: "rate", desc: false }]);
    else if (value === "status") setSorting([{ id: "status", desc: false }]);
    else if (value === "lastName") setSorting([{ id: "lastName", desc: false }]);
    else setSorting([{ id: "name", desc: false }]);
  };
  const effectiveVisibility = React.useMemo<VisibilityState>(
    () =>
      (blocksMode
        ? { name: true, rate: false, status: false, blocks: true }
        : { name: true, rate: true, status: true, blocks: false }) as VisibilityState,
    [blocksMode],
  );
  const table = useReactTable({ data, columns, getRowId: (row) => row.id, onSortingChange: setSorting, onColumnFiltersChange: setColumnFilters, getCoreRowModel: getCoreRowModel(), getSortedRowModel: getSortedRowModel(), getFilteredRowModel: getFilteredRowModel(), state: { sorting, columnFilters, columnVisibility: effectiveVisibility } });
  // Dirty-only: send just the rows the teacher actually changed since the last
  // save (local pick differs from the server mark). Unmarked rows are never
  // submitted.
  const delta = React.useMemo(
    () =>
      data.filter(
        (d): d is RosterRow & { status: SheetStatus } =>
          d.status !== null && marks[d.id] !== undefined && marks[d.id] !== serverMarks[d.id],
      ),
    [data, marks, serverMarks],
  );
  const deltaBreakdown = React.useMemo(() => {
    const c: Record<SheetStatus, number> = { present: 0, absent: 0, late: 0, excused: 0 };
    for (const d of delta) c[d.status] += 1;
    return (Object.keys(c) as SheetStatus[]).filter((s) => c[s] > 0).map((s) => `${c[s]} ${s}`).join(", ");
  }, [delta]);
  const deltaPills = React.useMemo(() => {
    const c: Record<SheetStatus, number> = { present: 0, absent: 0, late: 0, excused: 0 };
    for (const d of delta) c[d.status] += 1;
    return (Object.keys(c) as SheetStatus[])
      .filter((s) => c[s] > 0)
      .map((s) => ({ status: s, count: c[s] }));
  }, [delta]);
  async function handleSaveConfirm() {
    const ctx = roster?.ctx ?? null;
    if (!ctx || !subjectId || saving) return;
    if (delta.length === 0) {
      setSaveError("No changes to save — update at least one status first.");
      return;
    }
    // Shared Dock opens this tick and keeps settling even if the user
    // navigates away mid-flight.
    const count = delta.length;
    const summary = deltaBreakdown;
    let taskId: string | null = null;
    try {
      taskId = dockRef.current.startTask({ kind: "attendance-save", title: "Saving attendance", description: `Saving ${count} record${count === 1 ? "" : "s"}…`, total: count });
    } catch {
      taskId = null;
    }
    setSaveOpen(false);
    setSaveError(null);
    setSaving(true);
    try {
      const result = await submitSheet({ sectionId: ctx.sectionId, termId: ctx.termId, date: `${date}T00:00:00Z`, subjectId, assignmentId, slot, records: delta.map((d) => ({ studentId: d.id, status: d.status })) });
      setMarks({});
      try {
        if (taskId) dockRef.current.completeTask(taskId, `${result.count} record${result.count === 1 ? "" : "s"} submitted${summary ? ` · ${summary}` : ""}`);
      } catch {
        /* ignore */
      }
      invalidateTeacher.marks();
      toast.success({ title: "Attendance saved", description: `${result.count} record${result.count === 1 ? "" : "s"} submitted.` });
    } catch (err) {
      const message = apiErrorMessage(err, "Could not save attendance. Try again.");
      const code =
        (err as { response?: { data?: { error?: { code?: string } } } })?.response?.data?.error
          ?.code ?? null;
      try {
        if (taskId) dockRef.current.failTask(taskId, message);
      } catch {
        /* ignore */
      }
      setSaveError(message);
      toast.error({ title: "Could not save attendance", description: message });
      if (code === "TERM_NOT_VERIFIED") {
        // The server is authoritative on grants: snap local grant state to
        // truth so the verify gate appears (marks stay local, nothing lost).
        void queryClient.invalidateQueries({ queryKey: ["teacher-schedule-me"] });
        invalidateTeacher.schedule();
      }
    } finally {
      setSaving(false);
    }
  }
  const boardIcon = (
    <span className="text-amber-500" aria-hidden>
      <Users size={14} />
    </span>
  );
  const sheetDesc =
    date === phTodayKey()
      ? "Mark today's sheet for this subject and section."
      : `Viewing the ${date} sheet for this subject and section.`;
  const rows = table.getRowModel().rows;
  if (loading) {
    return (
      <section aria-label="Class attendance" className="flex min-w-0 flex-col gap-3">
        <KanbanBoard
          title="Class attendance"
          icon={boardIcon}
          description="Loading sheet…"
          ariaLabel="Loading roster"
        >
          <div aria-busy="true" aria-label="Loading roster">
            {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
              <div key={i} className={rowStyles.row} aria-hidden>
                <Skeleton className="h-5 w-full rounded-md" />
                <span className={rowStyles.sep}>|</span>
                <span className={rowStyles.titleCell}>
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-5 w-16 rounded-md" />
                </span>
                <span className={rowStyles.metaCell}>
                  <Skeleton className="h-5 w-16 rounded-md" />
                  <Skeleton className="h-5 w-12 rounded-md" />
                  <Skeleton className="h-7 w-32 rounded-md" />
                  <Skeleton className="h-6 w-6 rounded-full" />
                </span>
              </div>
            ))}
          </div>
        </KanbanBoard>
      </section>
    );
  }
  if (loadError) {
    return (<p role="alert" className="text-sm text-destructive">Could not load the class roster.</p>);
  }
  const headerActions = (
    <span className="flex items-center gap-1.5">
      <InputGroup className="h-6 w-32 shrink-0 text-xs sm:w-36">
        <InputGroupInput
          placeholder="Filter students..."
          value={(table.getColumn("name")?.getFilterValue() as string) ?? ""}
          onChange={(event) => table.getColumn("name")?.setFilterValue(event.target.value)}
          aria-label="Filter students"
          className="h-6 text-xs"
        />
        <InputGroupAddon><SearchIcon size={12} /></InputGroupAddon>
      </InputGroup>
      <span className="w-24 shrink-0 sm:w-28">
        <DropdownSelect
          value={sortValue}
          onValueChange={handleSortChange}
          options={SORT_OPTIONS}
          placeholder="Sort…"
          ariaLabel="Sort students"
          triggerClassName={`${dropdownStyles.dropdown24} text-left`}
        />
      </span>
    </span>
  );
  return (
    <section aria-label="Class attendance" className="flex min-w-0 flex-col gap-3">
      <KanbanBoard
        title="Class attendance"
        icon={boardIcon}
        count={data.length === 0 ? undefined : rows.length}
        actions={data.length === 0 ? undefined : headerActions}
        description={sheetDesc}
        footer={
          data.length === 0 ? undefined : (
            <div className="flex items-center justify-between gap-2 px-1 pb-1">
              <span className="text-sm text-muted-foreground">
                {rows.length} student{rows.length === 1 ? "" : "s"}
              </span>
              <Button size="sm" className="h-6 px-2.5 text-xs" onClick={openSave} disabled={live.locked || delta.length === 0} title={delta.length === 0 ? "Update at least one status to enable saving" : undefined}>Save{delta.length > 0 ? ` (${delta.length})` : ""}</Button>
            </div>
          )
        }
      >
        {data.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-1 py-6 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted" aria-hidden="true"><Users size={24} className="text-muted-foreground" /></span>
            <p className="font-medium">No students yet</p>
            <p className="max-w-sm text-sm text-muted-foreground">Students will appear here once they are enlisted in this section.</p>
          </div>
        ) : rows.length === 0 ? (
          <KanbanBoardEmpty>No students match your search.</KanbanBoardEmpty>
        ) : (
          <ul
            className={`${rowStyles.list} ${rowStyles.listBleed}`}
            style={{ "--row-list-gutter": "0.625rem" } as React.CSSProperties}
            aria-label="Class attendance roster"
          >
            {rows.map((row) => {
              const r = row.original;
              const pill = r.status ? MARK_PILL[r.status] : null;
              const pillLabel = pill ? pill.label : "Unmarked";
              const pct = r.rate === null ? "—" : `${Math.round(r.rate * 100)}%`;
              return (
                <li
                  key={r.id}
                  className={rowStyles.row}
                  aria-label={`${r.name}, ${pillLabel}, attendance ${pct}`}
                >
                  {!blocksMode || pill ? (
                    <span className={`${PILL_BASE} w-fit max-w-full justify-center ${pill ? pill.tone : UNMARKED_PILL}`}>
                      {pillLabel}
                    </span>
                  ) : (
                    <span aria-hidden />
                  )}
                  <span className={rowStyles.sep} aria-hidden>
                    |
                  </span>
                  <span className={rowStyles.titleCell}>
                    <StudentMascot
                      name={r.name}
                      seed={r.lrn}
                      character={mascotById.get(r.id)}
                      size={28}
                    />
                    <span className={rowStyles.title} title={r.name}>
                      {r.name}
                    </span>
                    <span
                      className="inline-flex shrink-0 items-center rounded-md border border-border bg-secondary px-1.5 py-0.5 text-[11px] font-medium text-secondary-foreground"
                      title={r.lrn}
                    >
                      {r.lrn}
                    </span>
                  </span>
                  <span className={rowStyles.metaCell}>
                    {blocksMode ? (
                      <span className="w-[22.5rem] max-w-full flex-none">
                        <MeetupBlocksCell
                          dates={blocksInfo.dates}
                          statusOf={blocksInfo.statusOf}
                          pastDue={blocksInfo.pastDue}
                          loading={blocksInfo.loading}
                          hasTerm={blocksInfo.hasTerm}
                          studentId={r.id}
                        />
                      </span>
                    ) : (
                      <span className="flex min-w-0 flex-1 items-center gap-1.5">
                        <span
                          className={`${PILL_BASE} shrink-0 gap-1 tabular-nums ${r.rate === null ? UNMARKED_PILL : ratePillTone(r.rate)}`}
                          title={r.rate === null ? "No meetups yet" : `Attendance rate ${pct}`}
                        >
                          {pct}
                        </span>
                        <StatusBoxes
                          value={r.status}
                          onPick={(s) => pick(r.id, s)}
                          disabled={live.locked}
                          impliedAbsent={r.impliedAbsent}
                        />
                      </span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </KanbanBoard>
      <SaveAttendanceKanban open={saveOpen} saving={saving} saveError={saveError} count={delta.length} breakdown={deltaPills} onClose={() => setSaveOpen(false)} onConfirm={() => void handleSaveConfirm()} />
    </section>
  );
}
