"use client";

import * as React from "react";
import { useTeacherInvalidate } from "../../components/use-teacher-invalidate";
import {
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  flexRender,
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";
import {
  Clock,
  Loader2,
  SearchIcon,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { CardModal } from "@/components/ui/CardModal";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { InputGroup, InputGroupInput, InputGroupAddon } from "@/components/ui/input-group";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/sonner";
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";
import styles from "@/app/teacher/overview/components/teacher-overview-advisory.module.css";
import sheetStyles from "./attendance-sheet.module.css";
import {
  phTodayKey,
  submitSheet,
  useMeetupDates,
  useSheetMarks,
  type SheetContext,
  type SheetStatus,
} from "./attendance-taking-data";

interface RosterRow {
  id: string;
  name: string;
  lrn: string;
  rate: number | null;
  status: SheetStatus;
}

const MARKS_STORAGE_KEY = "zentra.attendance-marks";
const MAX_STORED_SHEETS = 30;

const VALID_STATUSES: SheetStatus[] = ["present", "absent", "late", "excused"];

function loadStoredMarks(key: string): Record<string, SheetStatus> {
  try {
    if (typeof window === "undefined") return {};
    const raw = window.localStorage.getItem(MARKS_STORAGE_KEY);
    if (!raw) return {};
    const all = JSON.parse(raw) as Record<string, Record<string, SheetStatus>>;
    const mine = all[key];
    if (!mine || typeof mine !== "object") return {};
    const clean: Record<string, SheetStatus> = {};
    for (const [id, s] of Object.entries(mine)) {
      if ((VALID_STATUSES as string[]).includes(s)) clean[id] = s;
    }
    return clean;
  } catch {
    return {};
  }
}

function persistStoredMarks(key: string, marks: Record<string, SheetStatus>): void {
  try {
    const raw = window.localStorage.getItem(MARKS_STORAGE_KEY);
    const all: Record<string, Record<string, SheetStatus>> = raw
      ? (JSON.parse(raw) as Record<string, Record<string, SheetStatus>>)
      : {};
    const keys = Object.keys(all);
    if (!all[key] && keys.length >= MAX_STORED_SHEETS) {
      for (const k of keys.slice(0, keys.length - MAX_STORED_SHEETS + 1)) delete all[k];
    }
    all[key] = marks;
    window.localStorage.setItem(MARKS_STORAGE_KEY, JSON.stringify(all));
  } catch {
    // Storage blocked or full — picks still hold in memory for the visit.
  }
}

function rateClass(rate: number): string {
  if (rate >= 0.9) return "text-green-600 dark:text-green-500";
  if (rate >= 0.75) return "text-amber-600 dark:text-amber-500";
  return "text-red-600 dark:text-red-500";
}

const STATUS_BOXES: { value: SheetStatus; letter: string; activeClass: string; label: string }[] = [
  { value: "present", letter: "P", activeClass: "bg-green-500/70 border-green-500/70 text-white", label: "Present" },
  { value: "absent", letter: "A", activeClass: "bg-red-500/70 border-red-500/70 text-white", label: "Absent" },
  { value: "late", letter: "L", activeClass: "bg-amber-500/70 border-amber-500/70 text-white", label: "Late" },
  { value: "excused", letter: "E", activeClass: "bg-blue-500/70 border-blue-500/70 text-white", label: "Excused" },
];

function StatusBoxes({
  value,
  onPick,
  disabled,
}: {
  value: SheetStatus;
  onPick: (s: SheetStatus) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-1">
      {STATUS_BOXES.map((b) => {
        const isActive = b.value === value;
        return (
          <button
            key={b.value}
            type="button"
            onClick={() => onPick(b.value)}
            disabled={disabled}
            aria-pressed={isActive}
            aria-label={`Mark ${b.label}`}
            title={disabled ? `${b.label} — locked` : b.label}
            className={`flex h-7 w-7 items-center justify-center rounded-md border text-xs font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
              isActive
                ? b.activeClass
                : "border-input bg-transparent text-muted-foreground hover:border-foreground/40 hover:text-foreground"
            }`}
          >
            {b.letter}
          </button>
        );
      })}
    </div>
  );
}

/** Time gate for the sheet: live slots mark, finished slots edit, future
 *  (or undeterminable) slots stay locked. `todayEnd` is the last end
 *  minute of today's meetups — past meetup dates with no record display
 *  as absent instead of "no record". */
export interface AttendanceLive {
  locked: boolean;
  tone: "lock" | "info";
  message: string | null;
  nowMin: number;
  todayKey: string;
  todayEnd: number | null;
}

// Worst-status wins when several slots share a meetup day.
const DAY_RANK: Record<SheetStatus, number> = { present: 0, excused: 1, late: 2, absent: 3 };

const BLOCK_DOT: Record<SheetStatus, string> = {
  present: "bg-green-500",
  late: "bg-amber-500",
  absent: "bg-red-500",
  excused: "bg-gray-400",
};

const BLOCK_LABEL: Record<SheetStatus, string> = {
  present: "Present",
  absent: "Absent",
  late: "Late",
  excused: "Excused",
};

export interface BlocksInfo {
  dates: string[];
  statusOf: (id: string, date: string) => SheetStatus | null;
  /** True when a meetup date passed with no record — renders absent red
   *  instead of "no record". */
  pastDue: (date: string) => boolean;
  loading: boolean;
  hasTerm: boolean;
}

function makeBaseColumns(
  pick: (id: string, status: SheetStatus) => void,
  blocks: BlocksInfo,
  locked: boolean,
): ColumnDef<RosterRow>[] {
  return [
  {
    accessorKey: "name",
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
    accessorKey: "rate",
    header: "Attendance",
    size: 100,
    minSize: 90,
    sortingFn: (a, b) => (a.original.rate ?? -1) - (b.original.rate ?? -1),
    cell: ({ row }) => {
      const rate = row.getValue("rate") as number | null;
      if (rate === null) {
        return <span className="text-muted-foreground">—</span>;
      }
      return <div className={`font-medium tabular-nums ${rateClass(rate)}`}>{Math.round(rate * 100)}%</div>;
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    size: 180,
    minSize: 160,
    cell: ({ row }) => (
      <StatusBoxes
        value={row.getValue("status") as SheetStatus}
        onPick={(s) => pick(row.original.id, s)}
        disabled={locked}
      />
    ),
  },
  {
    id: "blocks",
    header: "Meetups",
    enableSorting: false,
    enableHiding: false,
    size: 360,
    minSize: 240,
    cell: ({ row }) => {
      if (blocks.loading) {
        return <span className="text-xs text-muted-foreground">Loading meetups…</span>;
      }
      if (!blocks.hasTerm || blocks.dates.length === 0) {
        return <span className="text-xs text-muted-foreground">No meetup dates.</span>;
      }
      return (
        <div
          className="flex items-center gap-[3px] overflow-x-auto py-0.5"
          style={{ scrollbarWidth: "none" }}
          role="img"
          aria-label={`${blocks.dates.length} meetup days`}
        >
          {blocks.dates.map((d) => {
            const s = blocks.statusOf(row.original.id, d);
            const autoAbsent = !s && blocks.pastDue(d);
            return (
              <span
                key={d}
                title={
                  s
                    ? `${d} — ${BLOCK_LABEL[s]}`
                    : autoAbsent
                      ? `${d} — absent (not logged)`
                      : `${d} — no record`
                }
                className={`h-[17px] w-[17px] shrink-0 rounded-[4px] border border-border/60 ${
                  s ? BLOCK_DOT[s] : autoAbsent ? "bg-red-500" : "bg-muted"
                }`}
              />
            );
          })}
        </div>
      );
    },
  },
  ];
}

interface AttendanceRosterTableProps {
  /** "YYYY-MM-DD" sheet date — picked from the navbar date picker. */
  date: string;
  subjectId: string | undefined;
  assignmentId?: string;
  slot: number;
  /** Per-section roster for the active (section, subject) pair — the ONLY
   *  student source. Per-subject sheets list the section's enlisted students
   *  (GET /api/attendance/section-roster), never the advisory list. */
  roster?: {
    ctx: SheetContext | null;
    pending: boolean;
    error: boolean;
    /** Card the teacher picked — when it differs from the loaded ctx, the
     *  sheet is mid-switch and must load, never render the old section. */
    requestedSectionId?: string | null;
  };
  /** Meetup weekdays (1 = Mon … 5 = Fri) of the active subject in the
   *  active section — drives the blocks-view columns. Defaults to all. */
  meetupDays?: number[];
  /** Time gate for marking. Required — the sheet never marks unlocked. */
  live: AttendanceLive;
  /** Extra class for the table container (e.g. the calculated floor). */
  stretchClassName?: string;
}

/* Class roster as a data table (data-table5 pattern: sortable + draggable
   columns, name filter, column visibility, row selection, pagination).
   Status reflects submitted marks for the active date/subject/slot. */
export function AttendanceRosterTable({
  date,
  subjectId,
  assignmentId,
  slot,
  roster,
  meetupDays = [1, 2, 3, 4, 5],
  live,
  stretchClassName,
}: AttendanceRosterTableProps) {
  const invalidateTeacher = useTeacherInvalidate();
  // Strictly per-section: no advisory fallback. Without a resolved section
  // roster the sheet has no students — it must never show advisees here.
  const effectiveCtx = roster?.ctx ?? null;
  const hasSection = !!effectiveCtx?.sectionId;
  const marksQuery = useSheetMarks(date, subjectId, slot, effectiveCtx?.sectionId ?? null);

  const students = React.useMemo(() => effectiveCtx?.students ?? [], [effectiveCtx]);
  const serverMarks = React.useMemo(() => marksQuery.data ?? {}, [marksQuery.data]);
  // Section correctness first: when the picked card's section is not the
  // loaded one (mid-switch with kept previous data), the sheet loads —
  // another section's roster is never presented as the current sheet.
  // Same-section background refetches (realtime invalidations) keep the
  // sheet visible since the ids already match.
  const switchingSection =
    !!roster?.requestedSectionId && effectiveCtx?.sectionId !== roster.requestedSectionId;
  // Section roster drives loading. Marks only block when actually fetching
  // (a disabled marks query is idle — no section/subject yet — and must not
  // hold the sheet in skeleton).
  const marksLoading = marksQuery.fetchStatus !== "idle" && marksQuery.isPending;
  const loading = switchingSection || (roster?.pending ?? false) || marksLoading;
  const loadError = (roster?.error ?? false) || (hasSection && marksQuery.isError);

  // Local picks layer on top of server marks (a new date/section/subject
  // is a new sheet — swap to its stored picks). Picks persist per sheet in
  // localStorage, so a refresh, lost connection, or closed tab never drops
  // marking progress. Submit wiring comes with the marking rebuild.
  const sheetKey = `${date}|${effectiveCtx?.sectionId ?? "none"}|${subjectId ?? "none"}|${slot}`;
  const [seenKey, setSeenKey] = React.useState(sheetKey);
  const [marks, setMarks] = React.useState<Record<string, SheetStatus>>(() =>
    loadStoredMarks(sheetKey),
  );
  if (seenKey !== sheetKey) {
    setSeenKey(sheetKey);
    setMarks(loadStoredMarks(sheetKey));
  }

  React.useEffect(() => {
    persistStoredMarks(sheetKey, marks);
  }, [sheetKey, marks]);

  const pick = React.useCallback((id: string, status: SheetStatus) => {
    setMarks((prev) => ({ ...prev, [id]: status }));
  }, []);

  const [saveOpen, setSaveOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);

  // Save opens from the header Save button (never while locked).
  const openSave = () => {
    if (live.locked) return;
    setSaveError(null);
    setSaveOpen(true);
  };

  // Same record set as the advisory matrix: every subject teacher's
  // takes for this subject — never fabricated, blanks stay blank.
  // Meetup keys come from the shared hook so the sheet and the navbar date
  // picker agree on which dates are markable.
  const {
    days: subjectDays,
    dateKeys,
    isPending: meetupPending,
    hasTerm: hasMeetupTerm,
  } = useMeetupDates(effectiveCtx?.sectionId ?? undefined, subjectId, meetupDays);
  const meetupDates = dateKeys ?? [];

  // Per-student day statuses, indexed once (worst status wins a day).
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

  const dayStatusOf = React.useCallback(
    (id: string, day: string): SheetStatus | null =>
      dayStatusByStudent.get(id)?.get(day) ?? null,
    [dayStatusByStudent],
  );

  const blocksInfo = React.useMemo<BlocksInfo>(
    () => ({
      dates: meetupDates,
      statusOf: dayStatusOf,
      pastDue: (day: string) =>
        day < live.todayKey ||
        (day === live.todayKey && live.todayEnd !== null && live.nowMin >= live.todayEnd),
      loading: meetupPending,
      hasTerm: hasMeetupTerm,
    }),
    [meetupDates, dayStatusOf, meetupPending, hasMeetupTerm, live],
  );

  const baseColumns = React.useMemo(
    () => makeBaseColumns(pick, blocksInfo, live.locked),
    // openSave reads the current lock flag; columns rebuild with it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pick, blocksInfo, live.locked],
  );

  // Attendance % = present ÷ elapsed meetups for THIS subject — the same
  // basis as the advisory matrix, so both views always agree. Elapsed
  // meetups with no record count as absent; nothing elapsed renders blank.
  const data = React.useMemo<RosterRow[]>(() => {
    const elapsed = meetupDates.filter((d) => d <= live.todayKey);
    return students.map((s) => {
      const days = dayStatusByStudent.get(s.studentId);
      let present = 0;
      for (const d of elapsed) {
        if (days?.get(d) === "present") present += 1;
      }
      return {
        id: s.studentId,
        name: s.name,
        lrn: s.lrn,
        rate: elapsed.length === 0 ? null : present / elapsed.length,
        status: marks[s.studentId] ?? serverMarks[s.studentId] ?? "present",
      };
    });
  }, [students, serverMarks, marks, meetupDates, dayStatusByStudent, live.todayKey]);

  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [blocksMode, setBlocksMode] = React.useState(false);

  const columns = React.useMemo<ColumnDef<RosterRow>[]>(() => baseColumns, [baseColumns]);

  // Blocks mode collapses the table to Student + Meetups only.
  const effectiveVisibility: VisibilityState = blocksMode
    ? { name: true, rate: false, status: false, blocks: true }
    : { blocks: false };

  const table = useReactTable({
    data,
    columns,
    getRowId: (row) => row.id,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    state: {
      sorting,
      columnFilters,
      columnVisibility: effectiveVisibility,
    },
  });

  const saveCounts = React.useMemo(() => {
    const c: Record<SheetStatus, number> = { present: 0, absent: 0, late: 0, excused: 0 };
    for (const d of data) c[d.status] += 1;
    return c;
  }, [data]);
  const saveBreakdown = (Object.keys(saveCounts) as SheetStatus[])
    .filter((s) => saveCounts[s] > 0)
    .map((s) => `${saveCounts[s]} ${s}`)
    .join(", ");

  async function handleSaveConfirm() {
    const ctx = effectiveCtx;
    if (!ctx || !subjectId || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      const result = await submitSheet({
        sectionId: ctx.sectionId,
        termId: ctx.termId,
        date: `${date}T00:00:00Z`,
        subjectId,
        assignmentId,
        slot,
        records: data.map((d) => ({ studentId: d.id, status: d.status })),
      });
      setMarks({});
      setSaveOpen(false);
      invalidateTeacher.marks();
      toast.success({
        title: "Attendance saved",
        description: `${result.count} record${result.count === 1 ? "" : "s"} submitted.`,
      });
    } catch {
      setSaveError("Could not save attendance. Try again.");
    } finally {
      setSaving(false);
    }
  }

  // Geometry-matched skeleton: same card + header/filter row, four table
  // columns (Student 220 two-line / Attendance 100 / Status 180 boxes /
  // Meetups 360 dot strip), 8 rows, and pager footer as the loaded table.
  if (loading) {
    return (
      <section aria-label="Class attendance" className="flex min-w-0 flex-col gap-3">
        <div className={assign.card} aria-busy="true" aria-label="Loading roster" aria-hidden>
          <span className={assign.glowClip} aria-hidden="true">
            <span className={assign.cardGlow} />
          </span>
          <div className="relative flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="mt-1 h-4 w-64" />
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Skeleton className="h-9 w-40" />
              <Skeleton className="h-9 w-20" />
              <Skeleton className="h-9 w-16" />
            </div>
          </div>
          <div className="relative overflow-x-auto rounded-md border">
            <div className="flex bg-muted/50" aria-hidden>
              <Skeleton className="m-2 h-4 rounded" style={{ width: 220 }} />
              <Skeleton className="m-2 h-4 rounded" style={{ width: 100 }} />
              <Skeleton className="m-2 h-4 rounded" style={{ width: 180 }} />
              <Skeleton className="m-2 h-4 flex-1 rounded" />
            </div>
            {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
              <div key={i} className="flex items-center gap-2 border-t px-3 py-2">
                <div className="flex min-w-0 flex-col gap-1.5" style={{ width: 220 }}>
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
                <Skeleton className="h-5 w-12 rounded" style={{ width: 100 }} />
                <div className="flex gap-1" style={{ width: 180 }}>
                  <Skeleton className="h-7 flex-1 rounded" />
                  <Skeleton className="h-7 flex-1 rounded" />
                  <Skeleton className="h-7 flex-1 rounded" />
                  <Skeleton className="h-7 flex-1 rounded" />
                </div>
                <div className="flex min-w-0 flex-1 items-center gap-1" aria-hidden>
                  {Array.from({ length: 12 }).map((_, d) => (
                    <Skeleton key={d} className="h-3 w-3 shrink-0 rounded-full" />
                  ))}
                </div>
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

  if (loadError) {
    return (
      <p role="alert" className="text-sm text-destructive">
        Could not load the class roster.
      </p>
    );
  }

  /* Same data-table pattern as the overview At-Risk Advisees table:
     section wrapper, assign.card, title + desc header with the filter on
     the right, fixed table, h-24 filtered-empty, count footer. The sheet
     lists every enrolled student (no pagination); only the columns differ
     (marking needs Status / Attendance / Meetups). */
  return (
    <section aria-label="Class attendance" className="flex min-w-0 flex-col gap-3">
    {data.length === 0 ? (
      <div className={assign.card}>
        <span className={assign.glowClip} aria-hidden="true">
          <span className={assign.cardGlow} />
        </span>
        <div className="relative">
          <h2 className={styles.sectionTitle}>Class attendance</h2>
          <p className={styles.sectionDesc}>
            {date === phTodayKey()
              ? "Mark today's sheet for this subject and section."
              : `Viewing the ${date} sheet for this subject and section.`}
          </p>
        </div>
        <div className="relative flex flex-col items-center gap-2 py-6 text-center">
          <span
            className="flex h-12 w-12 items-center justify-center rounded-full bg-muted"
            aria-hidden="true"
          >
            <Users size={24} className="text-muted-foreground" />
          </span>
          <p className="font-medium">No students yet</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Students will appear here once they are enlisted in this section.
          </p>
        </div>
      </div>
    ) : (
    <div className={assign.card}>
      <span className={assign.glowClip} aria-hidden="true">
        <span className={assign.cardGlow} />
      </span>
      <div className="relative flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className={styles.sectionTitle}>Class attendance</h2>
          <p className={styles.sectionDesc}>
            {date === phTodayKey()
              ? "Mark today's sheet for this subject and section."
              : `Viewing the ${date} sheet for this subject and section.`}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <InputGroup className="max-w-40 shrink-0">
            <InputGroupInput
              placeholder="Filter students..."
              value={(table.getColumn("name")?.getFilterValue() as string) ?? ""}
              onChange={(event) => table.getColumn("name")?.setFilterValue(event.target.value)}
              aria-label="Filter students"
            />
            <InputGroupAddon>
              <SearchIcon />
            </InputGroupAddon>
          </InputGroup>
          <Button
            variant={blocksMode ? "default" : "outline"}
            onClick={() => setBlocksMode((v) => !v)}
            aria-pressed={blocksMode}
            title="Toggle meetup blocks view"
            className={blocksMode ? "opacity-70" : undefined}
          >
            Blocks
          </Button>
          <Button onClick={openSave} disabled={live.locked}>
            Save
          </Button>
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
          {table.getFilteredRowModel().rows.length} student
          {table.getFilteredRowModel().rows.length === 1 ? "" : "s"}
        </div>
      </div>
    </div>
    )}
      {live.message && live.tone !== "lock" ? (
        <div
          role="note"
          aria-label={live.message}
          className={`${assign.card} ${sheetStyles.floatCard}`}
          style={{
            position: "fixed",
            right: "1rem",
            bottom: "1rem",
            zIndex: 40,
            width: "19rem",
            maxWidth: "calc(100vw - 2rem)",
            borderColor: "color-mix(in oklch, #f59e0b 45%, transparent)",
            background:
              "linear-gradient(135deg, color-mix(in oklch, #f59e0b 26%, var(--card)), color-mix(in oklch, #d9770f 18%, var(--card)))",
          }}
        >
          <span className={assign.glowClip} aria-hidden="true">
            <span className={assign.cardGlow} />
          </span>
          <div className="relative flex items-center gap-3">
            <span
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-500/15"
              aria-hidden="true"
            >
              <Clock size={20} className="text-amber-500" />
            </span>
            <div className="min-w-0">
              <h3 className="font-semibold">
                {live.message.includes("live now") ? "Live now" : "Editable"}
              </h3>
              <p className="text-xs text-muted-foreground">{live.message}</p>
            </div>
          </div>
        </div>
      ) : null}
      {saveOpen ? (
        <CardModal
          open
          onClose={() => {
            if (!saving) setSaveOpen(false);
          }}
          dismissable={!saving}
          size="sm"
          title="Save attendances?"
          description={
            <>
              Submits {data.length} student{data.length === 1 ? "" : "s"}
              {saveBreakdown ? ` — ${saveBreakdown}` : ""} for this sheet.
            </>
          }
        >
          {saveError ? (
            <p role="alert" className="text-sm text-destructive">
              {saveError}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button variant="destructive" onClick={() => setSaveOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSaveConfirm} disabled={saving} aria-busy={saving || undefined}>
              {saving ? (
                <>
                  <Loader2 size={16} className="animate-spin" aria-hidden />
                  <span aria-live="polite">Saving…</span>
                </>
              ) : (
                "Save attendances"
              )}
            </Button>
          </div>
        </CardModal>
      ) : null}
    </section>
  );
}
