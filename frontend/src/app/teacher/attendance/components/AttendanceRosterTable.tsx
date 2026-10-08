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
import { Clock, SearchIcon, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { InputGroup, InputGroupInput, InputGroupAddon } from "@/components/ui/input-group";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/sonner";
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";
import styles from "@/app/teacher/overview/components/teacher-overview-advisory.module.css";
import sheetStyles from "./attendance-sheet.module.css";
import { phTodayKey, submitSheet, useMeetupDates, useSheetMarks } from "@/services/teacher/attendance.service";
import type { SheetContext, SheetStatus } from "@/services/teacher/attendance.types";
import { MeetupBlocksCell, StatusBoxes, rateClass } from "./status-boxes";
import { useRosterMarks } from "./use-roster-marks";
import { SaveAttendanceDialog } from "./save-attendance-dialog";
interface RosterRow {
  id: string;
  name: string;
  lrn: string;
  rate: number | null;
  status: SheetStatus;
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
function makeBaseColumns(pick: (id: string, status: SheetStatus) => void, blocks: BlocksInfo, locked: boolean): ColumnDef<RosterRow>[] {
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
        if (rate === null) return <span className="text-muted-foreground">—</span>;
        return <div className={`font-medium tabular-nums ${rateClass(rate)}`}>{Math.round(rate * 100)}%</div>;
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      size: 180,
      minSize: 160,
      cell: ({ row }) => (
        <StatusBoxes value={row.getValue("status") as SheetStatus} onPick={(s) => pick(row.original.id, s)} disabled={locked} />
      ),
    },
    {
      id: "blocks",
      header: "Meetups",
      enableSorting: false,
      enableHiding: false,
      size: 360,
      minSize: 240,
      cell: ({ row }) => (
        <MeetupBlocksCell dates={blocks.dates} statusOf={blocks.statusOf} pastDue={blocks.pastDue} loading={blocks.loading} hasTerm={blocks.hasTerm} studentId={row.original.id} />
      ),
    },
  ];
}
interface AttendanceRosterTableProps {
  date: string;
  subjectId: string | undefined;
  assignmentId?: string;
  slot: number;
  roster?: { ctx: SheetContext | null; pending: boolean; error: boolean; requestedSectionId?: string | null };
  meetupDays?: number[];
  live: AttendanceLive;
  stretchClassName?: string;
}
export function AttendanceRosterTable({ date, subjectId, assignmentId, slot, roster, meetupDays = [1, 2, 3, 4, 5], live }: AttendanceRosterTableProps) {
  const invalidateTeacher = useTeacherInvalidate();
  const effectiveCtx = roster?.ctx ?? null;
  const hasSection = !!effectiveCtx?.sectionId;
  const marksQuery = useSheetMarks(date, subjectId, slot, effectiveCtx?.sectionId ?? null);
  const students = React.useMemo(() => effectiveCtx?.students ?? [], [effectiveCtx]);
  const serverMarks = React.useMemo(() => marksQuery.data ?? {}, [marksQuery.data]);
  const switchingSection = !!roster?.requestedSectionId && effectiveCtx?.sectionId !== roster.requestedSectionId;
  const marksLoading = marksQuery.fetchStatus !== "idle" && marksQuery.isPending;
  const loading = switchingSection || (roster?.pending ?? false) || marksLoading;
  const loadError = (roster?.error ?? false) || (hasSection && marksQuery.isError);
  const sheetKey = `${date}|${effectiveCtx?.sectionId ?? "none"}|${subjectId ?? "none"}|${slot}`;
  const { marks, setMarks, pick, merged } = useRosterMarks(sheetKey, serverMarks);
  void marks;
  const [saveOpen, setSaveOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const openSave = () => {
    if (live.locked) return;
    setSaveError(null);
    setSaveOpen(true);
  };
  const { days: subjectDays, dateKeys, isPending: meetupPending, hasTerm: hasMeetupTerm } = useMeetupDates(effectiveCtx?.sectionId ?? undefined, subjectId, meetupDays);
  const meetupDates = dateKeys ?? [];
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
  const blocksInfo = React.useMemo<BlocksInfo>(() => ({
    dates: meetupDates,
    statusOf: dayStatusOf,
    pastDue: (day: string) => day < live.todayKey || (day === live.todayKey && live.todayEnd !== null && live.nowMin >= live.todayEnd),
    loading: meetupPending,
    hasTerm: hasMeetupTerm,
  }), [meetupDates, dayStatusOf, meetupPending, hasMeetupTerm, live]);
  const baseColumns = React.useMemo(() => makeBaseColumns(pick, blocksInfo, live.locked), [pick, blocksInfo, live.locked]);
  const data = React.useMemo<RosterRow[]>(() => {
    const elapsed = meetupDates.filter((d) => d <= live.todayKey);
    return students.map((s) => {
      const days = dayStatusByStudent.get(s.studentId);
      let present = 0;
      for (const d of elapsed) {
        if (days?.get(d) === "present") present += 1;
      }
      return { id: s.studentId, name: s.name, lrn: s.lrn, rate: elapsed.length === 0 ? null : present / elapsed.length, status: merged[s.studentId] ?? "present" };
    });
  }, [students, merged, meetupDates, dayStatusByStudent, live.todayKey]);
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [blocksMode, setBlocksMode] = React.useState(false);
  const columns = React.useMemo<ColumnDef<RosterRow>[]>(() => baseColumns, [baseColumns]);
  const effectiveVisibility: VisibilityState = blocksMode ? { name: true, rate: false, status: false, blocks: true } : { blocks: false };
  const table = useReactTable({ data, columns, getRowId: (row) => row.id, onSortingChange: setSorting, onColumnFiltersChange: setColumnFilters, getCoreRowModel: getCoreRowModel(), getSortedRowModel: getSortedRowModel(), getFilteredRowModel: getFilteredRowModel(), state: { sorting, columnFilters, columnVisibility: effectiveVisibility } });
  const saveCounts = React.useMemo(() => {
    const c: Record<SheetStatus, number> = { present: 0, absent: 0, late: 0, excused: 0 };
    for (const d of data) c[d.status] += 1;
    return c;
  }, [data]);
  const saveBreakdown = (Object.keys(saveCounts) as SheetStatus[]).filter((s) => saveCounts[s] > 0).map((s) => `${saveCounts[s]} ${s}`).join(", ");
  async function handleSaveConfirm() {
    const ctx = effectiveCtx;
    if (!ctx || !subjectId || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      const result = await submitSheet({ sectionId: ctx.sectionId, termId: ctx.termId, date: `${date}T00:00:00Z`, subjectId, assignmentId, slot, records: data.map((d) => ({ studentId: d.id, status: d.status })) });
      setMarks({});
      setSaveOpen(false);
      invalidateTeacher.marks();
      toast.success({ title: "Attendance saved", description: `${result.count} record${result.count === 1 ? "" : "s"} submitted.` });
    } catch {
      setSaveError("Could not save attendance. Try again.");
    } finally {
      setSaving(false);
    }
  }
  if (loading) {
    return (
      <section aria-label="Class attendance" className="flex min-w-0 flex-col gap-3">
        <div className={assign.card} aria-busy="true" aria-label="Loading roster" aria-hidden>
          <span className={assign.glowClip} aria-hidden="true"><span className={assign.cardGlow} /></span>
          <div className="relative flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0"><Skeleton className="h-6 w-40" /><Skeleton className="mt-1 h-4 w-64" /></div>
            <div className="flex shrink-0 items-center gap-2"><Skeleton className="h-9 w-40" /><Skeleton className="h-9 w-20" /><Skeleton className="h-9 w-16" /></div>
          </div>
          <div className="relative overflow-x-auto rounded-md border">
            <div className="flex bg-muted/50" aria-hidden><Skeleton className="m-2 h-4 rounded" style={{ width: 220 }} /><Skeleton className="m-2 h-4 rounded" style={{ width: 100 }} /><Skeleton className="m-2 h-4 rounded" style={{ width: 180 }} /><Skeleton className="m-2 h-4 flex-1 rounded" /></div>
            {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
              <div key={i} className="flex items-center gap-2 border-t px-3 py-2">
                <div className="flex min-w-0 flex-col gap-1.5" style={{ width: 220 }}><Skeleton className="h-4 w-3/4" /><Skeleton className="h-3 w-1/2" /></div>
                <Skeleton className="h-5 w-12 rounded" style={{ width: 100 }} />
                <div className="flex gap-1" style={{ width: 180 }}><Skeleton className="h-7 flex-1 rounded" /><Skeleton className="h-7 flex-1 rounded" /><Skeleton className="h-7 flex-1 rounded" /><Skeleton className="h-7 flex-1 rounded" /></div>
                <div className="flex min-w-0 flex-1 items-center gap-1" aria-hidden>{Array.from({ length: 12 }).map((_, d) => (<Skeleton key={d} className="h-3 w-3 shrink-0 rounded-full" />))}</div>
              </div>
            ))}
          </div>
          <div className="relative flex items-center justify-end space-x-2"><Skeleton className="h-8 w-20" /><Skeleton className="h-8 w-20" /></div>
        </div>
      </section>
    );
  }
  if (loadError) {
    return (<p role="alert" className="text-sm text-destructive">Could not load the class roster.</p>);
  }
  return (
    <section aria-label="Class attendance" className="flex min-w-0 flex-col gap-3">
      {data.length === 0 ? (
        <div className={assign.card}>
          <span className={assign.glowClip} aria-hidden="true"><span className={assign.cardGlow} /></span>
          <div className="relative"><h2 className={styles.sectionTitle}>Class attendance</h2><p className={styles.sectionDesc}>{date === phTodayKey() ? "Mark today's sheet for this subject and section." : `Viewing the ${date} sheet for this subject and section.`}</p></div>
          <div className="relative flex flex-col items-center gap-2 py-6 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted" aria-hidden="true"><Users size={24} className="text-muted-foreground" /></span>
            <p className="font-medium">No students yet</p>
            <p className="max-w-sm text-sm text-muted-foreground">Students will appear here once they are enlisted in this section.</p>
          </div>
        </div>
      ) : (
        <div className={assign.card}>
          <span className={assign.glowClip} aria-hidden="true"><span className={assign.cardGlow} /></span>
          <div className="relative flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0"><h2 className={styles.sectionTitle}>Class attendance</h2><p className={styles.sectionDesc}>{date === phTodayKey() ? "Mark today's sheet for this subject and section." : `Viewing the ${date} sheet for this subject and section.`}</p></div>
            <div className="flex shrink-0 items-center gap-2">
              <InputGroup className="max-w-40 shrink-0"><InputGroupInput placeholder="Filter students..." value={(table.getColumn("name")?.getFilterValue() as string) ?? ""} onChange={(event) => table.getColumn("name")?.setFilterValue(event.target.value)} aria-label="Filter students" /><InputGroupAddon><SearchIcon /></InputGroupAddon></InputGroup>
              <Button variant={blocksMode ? "default" : "outline"} onClick={() => setBlocksMode((v) => !v)} aria-pressed={blocksMode} title="Toggle meetup blocks view" className={blocksMode ? "opacity-70" : undefined}>Blocks</Button>
              <Button onClick={openSave} disabled={live.locked}>Save</Button>
            </div>
          </div>
          <div className="relative overflow-x-auto rounded-md border">
            <Table className="w-full table-fixed">
              <TableHeader>{table.getHeaderGroups().map((headerGroup) => (<TableRow key={headerGroup.id} className="bg-muted/50 [&>th]:border-t-0">{headerGroup.headers.map((header) => (<TableHead key={header.id} style={{ width: header.getSize() }} onClick={header.column.getToggleSortingHandler()} className="h-10 cursor-pointer truncate whitespace-nowrap select-none">{header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}</TableHead>))}</TableRow>))}</TableHeader>
              <TableBody>{table.getRowModel().rows?.length ? (table.getRowModel().rows.map((row) => (<TableRow key={row.id}>{row.getVisibleCells().map((cell) => (<TableCell key={cell.id} style={{ width: cell.column.getSize() }} className="truncate">{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>))}</TableRow>))) : (<TableRow><TableCell colSpan={columns.length} className="h-24 text-center">No students match your search.</TableCell></TableRow>)}</TableBody>
            </Table>
          </div>
          <div className="relative flex items-center justify-end space-x-2"><div className="text-muted-foreground flex-1 text-sm">{table.getFilteredRowModel().rows.length} student{table.getFilteredRowModel().rows.length === 1 ? "" : "s"}</div></div>
        </div>
      )}
      {live.message && live.tone !== "lock" ? (
        <div role="note" aria-label={live.message} className={`${assign.card} ${sheetStyles.floatCard}`} style={{ position: "fixed", right: "1rem", bottom: "1rem", zIndex: 40, width: "19rem", maxWidth: "calc(100vw - 2rem)", borderColor: "color-mix(in oklch, #f59e0b 45%, transparent)", background: "linear-gradient(135deg, color-mix(in oklch, #f59e0b 26%, var(--card)), color-mix(in oklch, #d9770f 18%, var(--card)))" }}>
          <span className={assign.glowClip} aria-hidden="true"><span className={assign.cardGlow} /></span>
          <div className="relative flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-500/15" aria-hidden="true"><Clock size={20} className="text-amber-500" /></span>
            <div className="min-w-0"><h3 className="font-semibold">{live.message.includes("live now") ? "Live now" : "Editable"}</h3><p className="text-xs text-muted-foreground">{live.message}</p></div>
          </div>
        </div>
      ) : null}
      <SaveAttendanceDialog open={saveOpen} saving={saving} saveError={saveError} count={data.length} breakdown={saveBreakdown} onClose={() => setSaveOpen(false)} onConfirm={() => void handleSaveConfirm()} />
    </section>
  );
}
