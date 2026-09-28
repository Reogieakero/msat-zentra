"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";
import {
  ColumnsIcon,
  LayoutGrid,
  Loader2,
  Lock,
  SearchIcon,
  Users,
} from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { restrictToHorizontalAxis } from "@dnd-kit/modifiers";
import {
  arrayMove,
  SortableContext,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { DragAlongCell, DraggableHeader } from "@/components/data-table/drag-columns";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { InputGroup, InputGroupInput, InputGroupAddon } from "@/components/ui/input-group";
import { toast } from "@/components/ui/sonner";
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";
import {
  submitSheet,
  useSheetContext,
  useSheetMarks,
  useSubjectDays,
  initialsOf,
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
  onSelectAll: (selecting: boolean) => void,
  blocks: BlocksInfo,
  locked: boolean,
): ColumnDef<RosterRow>[] {
  return [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")
        }
        onCheckedChange={(value) => {
          const selecting = !!value;
          table.toggleAllPageRowsSelected(selecting);
          onSelectAll(selecting);
        }}
        disabled={locked}
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select row"
      />
    ),
    enableSorting: false,
    enableHiding: false,
    size: 50,
    minSize: 50,
    maxSize: 50,
  },
  {
    accessorKey: "name",
    header: "Student",
    size: 220,
    minSize: 160,
    cell: ({ row }) => (
      <div className="flex min-w-0 items-center gap-2">
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary"
          aria-hidden="true"
        >
          {initialsOf(row.getValue("name"))}
        </span>
        <span className="truncate font-medium">{row.getValue("name")}</span>
      </div>
    ),
  },
  {
    accessorKey: "lrn",
    header: "LRN",
    size: 130,
    minSize: 110,
    cell: ({ row }) => <div className="text-muted-foreground">{row.getValue("lrn")}</div>,
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
  date: string;
  subjectId: string | undefined;
  assignmentId?: string;
  slot: number;
  /** Explicit section roster (code-claimed flow). When provided, the table
   *  reads from it instead of the advisory context. */
  roster?: { ctx: SheetContext | null; pending: boolean; error: boolean };
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
/** Meetup dates across the term: every school day whose weekday is one of
 *  the subject's meetup days. Capped so the strip stays renderable. */
function enumerateMeetupDates(
  termStart: string | null,
  termEnd: string | null,
  meetupDays: number[],
): string[] {
  if (!termStart) return [];
  const start = new Date(`${termStart.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(start.getTime())) return [];
  const endRaw = termEnd ? new Date(`${termEnd.slice(0, 10)}T00:00:00Z`) : new Date();
  const end = new Date(`${endRaw.toISOString().slice(0, 10)}T00:00:00Z`);
  const out: string[] = [];
  for (let d = new Date(start); d <= end && out.length < 90; d = new Date(d.getTime() + 86_400_000)) {
    const dow = d.getUTCDay(); // 0 = Sun … 6 = Sat
    const day = dow === 0 ? 7 : dow; // 1 = Mon … 7 = Sun
    if (meetupDays.includes(day)) out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

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
  const queryClient = useQueryClient();
  const contextQuery = useSheetContext();
  const effectiveCtx = roster ? roster.ctx : (contextQuery.data ?? null);
  const marksQuery = useSheetMarks(date, subjectId, slot, effectiveCtx?.sectionId ?? null);

  const students = React.useMemo(() => effectiveCtx?.students ?? [], [effectiveCtx]);
  const serverMarks = React.useMemo(() => marksQuery.data ?? {}, [marksQuery.data]);
  const loading = (roster ? roster.pending : contextQuery.isPending) || marksQuery.isPending;
  const loadError = (roster ? roster.error : contextQuery.isError) || marksQuery.isError;

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

  // Header select-all means "save this sheet" — selecting all rows opens
  // the save-attendances dialog (never while locked); deselecting just
  // clears the selection.
  const openSave = (selecting: boolean) => {
    if (!selecting || live.locked) return;
    setSaveError(null);
    setSaveOpen(true);
  };

  // Same record set as the advisory matrix: every subject teacher's
  // takes for this subject — never fabricated, blanks stay blank.
  const daysQuery = useSubjectDays(effectiveCtx?.sectionId ?? undefined, subjectId);

  const meetupDates = React.useMemo(
    () =>
      enumerateMeetupDates(
        daysQuery.data?.termStart ?? null,
        daysQuery.data?.termEnd ?? null,
        meetupDays,
      ),
    [daysQuery.data, meetupDays],
  );

  // Per-student day statuses, indexed once (worst status wins a day).
  const dayStatusByStudent = React.useMemo(() => {
    const map = new Map<string, Map<string, SheetStatus>>();
    for (const r of daysQuery.data?.records ?? []) {
      let m = map.get(r.key);
      if (!m) {
        m = new Map<string, SheetStatus>();
        map.set(r.key, m);
      }
      const prev = m.get(r.date);
      if (!prev || DAY_RANK[r.status] > DAY_RANK[prev]) m.set(r.date, r.status);
    }
    return map;
  }, [daysQuery.data]);

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
      loading: daysQuery.isPending,
      hasTerm: !!daysQuery.data?.termStart,
    }),
    [meetupDates, dayStatusOf, daysQuery.isPending, daysQuery.data, live],
  );

  const baseColumns = React.useMemo(
    () => makeBaseColumns(pick, openSave, blocksInfo, live.locked),
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
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = React.useState({});
  const [blocksMode, setBlocksMode] = React.useState(false);
  const [columnOrder, setColumnOrder] = React.useState<string[]>(() => [
    "name",
    "lrn",
    "rate",
    "status",
    "blocks",
  ]);
  const sortableId = React.useId();

  const sensors = useSensors(
    useSensor(MouseSensor, {}),
    useSensor(TouchSensor, {}),
    useSensor(KeyboardSensor, {}),
  );

  const columns = React.useMemo<ColumnDef<RosterRow>[]>(() => {
    const selectColumn = baseColumns.find((col) => col.id === "select");
    const otherColumns = columnOrder
      .map((colId) =>
        baseColumns.find(
          (col) => col.id === colId || ("accessorKey" in col && col.accessorKey === colId),
        ),
      )
      .filter((col): col is ColumnDef<RosterRow> => col !== undefined);
    const result: ColumnDef<RosterRow>[] = [];
    if (selectColumn) result.push(selectColumn);
    result.push(...otherColumns);
    return result;
  }, [baseColumns, columnOrder]);

  const fullColumnOrder = React.useMemo<string[]>(() => ["select", ...columnOrder], [columnOrder]);

  // Blocks mode collapses the table to Student + Meetups only.
  const effectiveVisibility: VisibilityState = blocksMode
    ? { select: false, name: true, lrn: false, rate: false, status: false, blocks: true }
    : { ...columnVisibility, blocks: false };

  const table = useReactTable({
    data,
    columns,
    columnResizeMode: "onChange",
    getRowId: (row) => row.id,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onColumnOrderChange: (updater) => {
      const newOrder = typeof updater === "function" ? updater(fullColumnOrder) : updater;
      setColumnOrder(newOrder.filter((id: string) => id !== "select"));
    },
    state: {
      sorting,
      columnFilters,
      columnVisibility: effectiveVisibility,
      rowSelection,
      columnOrder: fullColumnOrder,
    },
  });

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (
      active &&
      over &&
      active.id !== over.id &&
      active.id !== "select" &&
      over.id !== "select"
    ) {
      setColumnOrder((order) => {
        const oldIndex = order.indexOf(active.id as string);
        const newIndex = order.indexOf(over.id as string);
        return arrayMove(order, oldIndex, newIndex);
      });
    }
  }

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
      setRowSelection({});
      setSaveOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["attendance-sheet-marks"] });
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

  if (loading) {
    return (
      <div className="flex flex-col gap-2" aria-busy="true" aria-label="Loading roster">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="h-10 rounded-md bg-muted" />
        ))}
      </div>
    );
  }

  if (loadError) {
    return (
      <p role="alert" className="text-sm text-destructive">
        Could not load the class roster.
      </p>
    );
  }

  return (
    <div className="flex w-full min-w-0 flex-1 flex-col space-y-4">
      {live.message && live.tone !== "lock" ? (
        <div
          role="note"
          className="rounded-lg border border-input bg-muted/40 px-3 py-2 text-sm text-muted-foreground"
        >
          {live.message}
        </div>
      ) : null}
      <div className="flex items-center gap-2">
        <InputGroup className="max-w-56">
          <InputGroupInput
            placeholder="Filter students..."
            value={(table.getColumn("name")?.getFilterValue() as string) ?? ""}
            onChange={(event) => table.getColumn("name")?.setFilterValue(event.target.value)}
          />
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
        </InputGroup>
        <div className="ml-auto flex items-center gap-2">
          <Button
            variant={blocksMode ? "default" : "outline"}
            onClick={() => setBlocksMode((v) => !v)}
            aria-pressed={blocksMode}
            title="Toggle meetup blocks view"
          >
            <LayoutGrid />
            Blocks
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <ColumnsIcon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {table
                .getAllColumns()
                .filter((column) => column.getCanHide())
                .map((column) => {
                  return (
                    <DropdownMenuCheckboxItem
                      key={column.id}
                      className="capitalize"
                      checked={column.getIsVisible()}
                      onCheckedChange={(value) => column.toggleVisibility(!!value)}
                    >
                      {column.id}
                    </DropdownMenuCheckboxItem>
                  );
                })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <div className={`flex-1 overflow-x-auto rounded-md border ${stretchClassName ?? ""}`}>
        <DndContext
          id={sortableId}
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToHorizontalAxis]}
          onDragEnd={handleDragEnd}
        >
          <Table className="w-full table-fixed">
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id} className="bg-muted/50 [&>th]:border-t-0">
                  <SortableContext items={columnOrder} strategy={horizontalListSortingStrategy}>
                    {headerGroup.headers.map((header) => (
                      <DraggableHeader key={header.id} header={header} />
                    ))}
                  </SortableContext>
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id} data-state={row.getIsSelected() && "selected"}>
                    <SortableContext items={columnOrder} strategy={horizontalListSortingStrategy}>
                      {row.getVisibleCells().map((cell) => (
                        <DragAlongCell key={cell.id} cell={cell} />
                      ))}
                    </SortableContext>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-64">
                    <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center">
                      <span
                        className="flex h-12 w-12 items-center justify-center rounded-full bg-muted"
                        aria-hidden="true"
                      >
                        <Users size={24} className="text-muted-foreground" />
                      </span>
                      <p className="font-medium">
                        {(table.getColumn("name")?.getFilterValue() as string) ?? ""
                          ? "No students match your search"
                          : "No students yet"}
                      </p>
                      <p className="max-w-sm text-sm text-muted-foreground">
                        {(table.getColumn("name")?.getFilterValue() as string) ?? ""
                          ? "Try a different search term."
                          : "Students will appear here once they are enlisted in this section."}
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </DndContext>
      </div>
      <div className="flex items-center justify-end space-x-2">
        <div className="text-muted-foreground flex-1 text-sm">
          {table.getFilteredSelectedRowModel().rows.length} of{" "}
          {table.getFilteredRowModel().rows.length} row(s) selected.
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
      {live.tone === "lock" && live.message ? (
        <div
          role="alert"
          aria-label={`Locked: ${live.message}`}
          className={`${assign.card} motion-safe:animate-bounce`}
          style={{
            position: "fixed",
            right: "1rem",
            bottom: "1rem",
            zIndex: 40,
            width: "20rem",
            maxWidth: "calc(100vw - 2rem)",
            borderColor: "color-mix(in oklch, #ef4444 45%, transparent)",
            background:
              "linear-gradient(135deg, color-mix(in oklch, #ef4444 26%, var(--card)), color-mix(in oklch, #dc2626 18%, var(--card)))",
          }}
        >
          <span className={assign.glowClip} aria-hidden="true">
            <span className={assign.cardGlow} />
          </span>
          <div className="relative flex items-center gap-3">
            <span
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-red-500/15"
              aria-hidden="true"
            >
              <Lock size={20} className="text-red-500" />
            </span>
            <div className="min-w-0">
              <h3 className="font-semibold">Locked</h3>
              <p className="text-xs text-muted-foreground">{live.message}</p>
            </div>
          </div>
        </div>
      ) : null}
      {saveOpen ? (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open && !saving) setSaveOpen(false);
          }}
        >
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Save attendances?</DialogTitle>
              <DialogDescription>
                Submits {data.length} student{data.length === 1 ? "" : "s"}
                {saveBreakdown ? ` — ${saveBreakdown}` : ""} for this sheet.
              </DialogDescription>
            </DialogHeader>
            {saveError ? (
              <p role="alert" className="text-sm text-destructive">
                {saveError}
              </p>
            ) : null}
            <DialogFooter>
              <Button variant="outline" onClick={() => setSaveOpen(false)} disabled={saving}>
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
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}
