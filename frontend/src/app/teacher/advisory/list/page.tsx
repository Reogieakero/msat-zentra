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
import { KanbanSquare, Loader2, MousePointerClick, Pencil, SearchIcon, UserPlus, Users } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { useTeacherInvalidate } from "../../components/use-teacher-invalidate";
import { markSelfNotified } from "@/lib/realtime/teacherChannel";
import { Button } from "@/components/ui/button";
import { KanbanBoard } from "@/components/ui/kanban-board";
import { KanbanOverlay } from "@/components/ui/kanban-overlay";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useDock } from "@/components/dock/dock-store";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupInput, InputGroupAddon } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Pill } from "@/components/ui/pill";
import { InsightCallout } from "@/components/ui/insight-callout";
import { riskBadgeVariant } from "@/lib/risk/status";
import { Pagination } from "@/components/shared/pagination";
import { useAdvisoryRoster } from "@/services/teacher/advisory.service";
import type { AdviseeRow } from "@/services/teacher/advisory.types";
import { compareSurnameFirst, formatSurnameFirst } from "@/lib/names";
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";
import { PAGE_SIZE } from "@/components/shared/pagination";
import { AdvisoryInsightBoard } from "./components/advisory-insight-board";
import { StudentMascot } from "../referrals/components/StudentMascot";
import listStyles from "./components/advisory-list.module.css";

function getErrorMessage(err: unknown, fallback: string): string {
  const data = (err as { response?: { data?: { error?: { message?: unknown }; message?: unknown } } })?.response?.data;
  const message = data?.error?.message ?? data?.message;
  if (typeof message === "string" && message) return message;
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

export default function TeacherAdvisoryListPage() {
  const rosterQuery = useAdvisoryRoster();
  const invalidateTeacher = useTeacherInvalidate();
  const students = React.useMemo(
    () =>
      [...(rosterQuery.data?.students ?? [])].sort((a, b) =>
        compareSurnameFirst(a.name, b.name),
      ),
    [rosterQuery.data],
  );
  const sectionLabel = React.useMemo(
    () => (rosterQuery.data?.advisorySections ?? []).map((s) => s.name).join(", "),
    [rosterQuery.data],
  );

  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  // Keep a valid selection as the roster loads / changes.
  React.useEffect(() => {
    if (students.length === 0) {
      setSelectedId(null);
      return;
    }
    setSelectedId((prev) =>
      prev && students.some((s) => s.studentId === prev) ? prev : students[0]!.studentId,
    );
  }, [students]);

  const selectedStudent = React.useMemo(
    () => students.find((s) => s.studentId === selectedId) ?? null,
    [students, selectedId],
  );

  const columns = React.useMemo<ColumnDef<AdviseeRow>[]>(
    () => [
      {
        id: "name",
        accessorFn: (row) => `${formatSurnameFirst(row.name)} ${row.lrn}`,
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
              <span
                className="block truncate text-[13px] font-semibold text-primary"
                title={row.original.name}
              >
                {formatSurnameFirst(row.original.name)}
              </span>
              <span className="mt-1 inline-flex max-w-full shrink-0 items-center truncate">
                <Pill tone="neutral" label="LRN">
                  {row.original.lrn}
                </Pill>
              </span>
            </div>
          </div>
        ),
      },
      {
        id: "riskLevel",
        accessorFn: (row) => row.riskLevel,
        header: "Risk",
        size: 100,
        minSize: 90,
        maxSize: 120,
        cell: ({ row }) => (
          <Pill tone={riskBadgeVariant(row.original.riskLevel)} label="Risk level">
            {row.original.riskLevel}
          </Pill>
        ),
      },
    ],
    [],
  );

  const table = useReactTable({
    data: students,
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

  const advisorySections = React.useMemo(
    () => rosterQuery.data?.advisorySections ?? [],
    [rosterQuery.data],
  );
  const [addOpen, setAddOpen] = React.useState(false);
  const [addName, setAddName] = React.useState("");
  const [addLrn, setAddLrn] = React.useState("");
  const [addSectionId, setAddSectionId] = React.useState("");
  const [addError, setAddError] = React.useState<string | null>(null);
  const dock = useDock();
  const dockTaskRef = React.useRef<string | null>(null);
  const editDockTaskRef = React.useRef<string | null>(null);

  const [editTarget, setEditTarget] = React.useState<AdviseeRow | null>(null);
  const [editOpen, setEditOpen] = React.useState(false);
  const [editArmed, setEditArmed] = React.useState(false);
  const [editName, setEditName] = React.useState("");
  const [editLrn, setEditLrn] = React.useState("");
  const [editError, setEditError] = React.useState<string | null>(null);

  function openEdit(row: AdviseeRow) {
    setSelectedId(row.studentId);
    setEditName(row.name);
    setEditLrn(row.lrn);
    setEditError(null);
    setEditTarget(row);
    setEditOpen(true);
    setEditArmed(false);
  }

  /** Row click: normally inspects; while the edit rail is armed it opens the editor. */
  function handleRowClick(row: AdviseeRow) {
    setSelectedId(row.studentId);
    if (editArmed) openEdit(row);
  }

  const editMutation = useMutation({
    mutationFn: async (payload: {
      studentId: string;
      fullName: string;
      lrn: string;
    }) => {
      const { data } = await apiClient.patch<{ studentId: string; name: string; lrn: string }>(
        `/api/teacher/advisory/roster/${encodeURIComponent(payload.studentId)}`,
        { fullName: payload.fullName, lrn: payload.lrn },
      );
      return data;
    },
    onError: (err) => {
      const message = getErrorMessage(err, "Could not save this student.");
      setEditError(message);
      if (editDockTaskRef.current) {
        dock.failTask(editDockTaskRef.current, message);
        editDockTaskRef.current = null;
      }
      // Reopen so the edited values are not lost.
      setEditOpen(true);
      toast.error({ title: "Could not update student", description: message });
    },
    onSuccess: (_data, payload) => {
      setSelectedId(payload.studentId);
      if (editDockTaskRef.current) {
        dock.completeTask(
          editDockTaskRef.current,
          `${payload.fullName} (${payload.lrn}) saved.`,
        );
        editDockTaskRef.current = null;
      }
      toast.success({
        title: "Student updated",
        description: `${payload.fullName} · LRN ${payload.lrn}`,
      });
    },
    onSettled: () => {
      invalidateTeacher.advisory();
    },
  });

  const editSaving = editMutation.isPending;

  function handleEditStudent() {
    if (!editTarget || editSaving) return;
    const fullName = editName.trim();
    const lrn = editLrn.trim();
    if (!fullName || !lrn) {
      setEditError("Name and LRN are both required.");
      return;
    }
    if (!/^\d{12}$/.test(lrn)) {
      setEditError("LRN must be exactly 12 digits (numbers only).");
      return;
    }
    setEditError(null);

    // Close first, then report the request in the shared Dock (bottom-right).
    setEditOpen(false);
    editDockTaskRef.current = dock.startTask({
      kind: "generic",
      title: "Updating student",
      description: `${fullName} · ${lrn}`,
    });
    editMutation.mutate({ studentId: editTarget.studentId, fullName, lrn });
  }

  function openAdd() {
    setAddName("");
    setAddLrn("");
    setAddSectionId(advisorySections[0]?.id ?? "");
    setAddError(null);
    setAddOpen(true);
  }

  const enlistMutation = useMutation({
    mutationFn: async (payload: { fullName: string; lrn: string; sectionId?: string }) => {
      const { data } = await apiClient.post<{ studentId?: string }>("/api/teacher/advisory/roster", payload);
      return data;
    },
    onError: (err) => {
      const message = getErrorMessage(err, "Could not enlist this student.");
      setAddError(message);
      if (dockTaskRef.current) {
        dock.failTask(dockTaskRef.current, message);
        dockTaskRef.current = null;
      }
      // Bring the form back so the entered name/LRN are not lost.
      setAddOpen(true);
      toast.error({ title: "Could not enlist student", description: message });
    },
    onSuccess: (data, payload) => {

      const rosterId = data?.studentId?.startsWith("roster:")
        ? data.studentId.slice("roster:".length)
        : undefined;
      if (rosterId) markSelfNotified(rosterId);
      if (dockTaskRef.current) {
        dock.completeTask(
          dockTaskRef.current,
          `${payload.fullName} added to your advisory section.`,
        );
        dockTaskRef.current = null;
      }
      toast.success({
        title: "Student enlisted",
        description: `${payload.fullName} was added to your advisory section.`,
      });
    },
    onSettled: () => {
      invalidateTeacher.advisory();
    },
  });

  const addSaving = enlistMutation.isPending;

  function handleAddStudent() {
    if (addSaving) return;
    const fullName = addName.trim();
    const lrn = addLrn.trim();
    if (!fullName || !lrn) {
      setAddError("Name and LRN are both required.");
      return;
    }
    if (!/^\d{12}$/.test(lrn)) {
      setAddError("LRN must be exactly 12 digits (numbers only).");
      return;
    }
    setAddError(null);

    // Close first, then report the request in the shared Dock (bottom-right).
    setAddOpen(false);
    dockTaskRef.current = dock.startTask({
      kind: "generic",
      title: "Enlisting student",
      description: `${fullName} · ${lrn}`,
    });
    enlistMutation.mutate({
      fullName,
      lrn,
      ...(addSectionId ? { sectionId: addSectionId } : {}),
    });
  }

  if (rosterQuery.isPending) {
    return (
      <section aria-label="Advisory list" className="flex min-w-0 flex-col gap-3">
        <div className={assign.card} aria-busy="true" aria-label="Loading advisory list" aria-hidden>
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
      <section aria-label="Advisory list" className="flex min-w-0 flex-col gap-3">
        <p role="alert" className="text-sm text-destructive">
          No advisory section assigned, or it could not be loaded. Contact the school
          office.
        </p>
      </section>
    );
  }

  return (
    <section aria-label="Advisory list" className="flex min-w-0 flex-col gap-3">
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
                Students enlisted in your advisory section will appear here.
              </p>
              <Button size="sm" className="mt-2" onClick={openAdd}>
                Add student
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid w-full items-start gap-4 lg:grid-cols-[minmax(0,1fr)_auto]">
          <div className={listStyles.panel} aria-label="Advisory board">
          <header className={listStyles.boardHead}>
            <span className={listStyles.boardIcon} aria-hidden>
              <KanbanSquare size={18} />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className={listStyles.boardTitle}>Advisory board</h2>
              <p className={listStyles.boardSub}>
                {`Click a row to inspect — ${students.length} student${students.length === 1 ? "" : "s"}${sectionLabel ? ` · ${sectionLabel}` : ""}.`}
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
                        return (
                          <TableRow
                            key={row.id}
                            onClick={() => handleRowClick(row.original)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                handleRowClick(row.original);
                              }
                            }}
                            tabIndex={0}
                            aria-selected={isSelected}
                            aria-label={
                              editArmed
                                ? `${row.original.name} — click to edit name and LRN`
                                : `${row.original.name}, ${row.original.riskLevel} risk — open insight`
                            }
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
            <div className={listStyles.right} aria-label="Student insight">
              <AdvisoryInsightBoard student={selectedStudent} bare />
            </div>
          </div>
          </div>

          {/* Right side bar — sits outside the advisory kanban board, same
              gutter pattern as the classes page. */}
          <div className="flex flex-row justify-end gap-2 self-start lg:sticky lg:top-16 lg:flex-col lg:items-end">
            <div className="relative">
              <TooltipProvider delayDuration={100}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={openAdd}
                      aria-label="Add student to your advisory section"
                      className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl border border-border bg-card transition-colors hover:border-amber-500/60 hover:bg-amber-500/10"
                    >
                      <span className="text-amber-500" aria-hidden>
                        <UserPlus size={16} />
                      </span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="left" sideOffset={10}>
                    <span className="font-medium">Add student</span>
                    <span className="opacity-60">Enlist to advisory</span>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

            <div className="relative">
              <TooltipProvider delayDuration={100}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => setEditArmed((prev) => !prev)}
                      aria-expanded={editArmed}
                      aria-pressed={editArmed}
                      aria-label={
                        editArmed
                          ? "Stop editing the student list"
                          : "Edit a student's name and LRN"
                      }
                      className={`flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl border transition-colors ${
                        editArmed
                          ? "border-amber-500/60 bg-amber-500/10"
                          : "border-border bg-card hover:border-amber-500/60 hover:bg-amber-500/10"
                      }`}
                    >
                      <span className="text-amber-500" aria-hidden>
                        <Pencil size={16} />
                      </span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="left" sideOffset={10}>
                    <span className="font-medium">Edit student</span>
                    <span className="opacity-60">Name &amp; LRN</span>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              {editArmed ? (
                <div
                  role="dialog"
                  aria-label="Edit student reminder"
                  className="absolute top-0 right-12 z-50 w-72 overflow-y-auto rounded-xl bg-card text-card-foreground shadow-xl ring-1 ring-border sm:w-80"
                >
                  <KanbanBoard
                    title="Edit student"
                    icon={
                      <span className="text-amber-500" aria-hidden>
                        <MousePointerClick size={14} />
                      </span>
                    }
                    description={
                      <>
                        Click the student in the list to be edited.
                      </>
                    }
                    className="border-0"
                    footer={
                      <div className="flex items-center justify-end gap-1.5 px-1 pb-1">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-6 px-2 text-xs"
                          onClick={() => setEditArmed(false)}
                        >
                          Cancel
                        </Button>
                      </div>
                    }
                  >
                    <p className="px-1 text-xs text-muted-foreground">
                      The learner&apos;s name and LRN can be corrected. LRNs stay 12
                      digits, numbers only.
                    </p>
                  </KanbanBoard>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}

      <KanbanOverlay
        open={addOpen}
        onClose={() => {
          if (!addSaving) setAddOpen(false);
        }}
        dismissable={!addSaving}
        busy={addSaving}
        width="sm"
        title="Add student"
        icon={
          <span className="text-primary" aria-hidden>
            <UserPlus size={14} />
          </span>
        }
        description={
          <>
            Enlist a student into your advisory section
            {advisorySections.length === 1 && advisorySections[0]
              ? ` (${advisorySections[0].name})`
              : ""}
            .
          </>
        }
        footer={
          <div className="flex items-center justify-end gap-1.5 px-1 pb-1">
            <Button
              type="button"
              size="sm"
              className="h-6 px-3 text-xs"
              onClick={() => void handleAddStudent()}
              disabled={addSaving}
              aria-busy={addSaving || undefined}
              autoFocus
            >
              {addSaving ? (
                <>
                  <Loader2 size={14} className="animate-spin" aria-hidden />
                  <span aria-live="polite">Enlisting…</span>
                </>
              ) : (
                "Enlist student"
              )}
            </Button>
          </div>
        }
      >
        <div className="flex min-w-0 flex-col gap-3 px-1">
          <div className="flex min-w-0 flex-col gap-1.5">
            <Label htmlFor="advisory-add-name">Full name</Label>
            <Input
              id="advisory-add-name"
              value={addName}
              onChange={(e) => {
                setAddName(e.target.value);
                setAddError(null);
              }}
              placeholder="e.g. Juan Garcia"
              maxLength={120}
            />
          </div>
          <div className="flex min-w-0 flex-col gap-1.5">
            <Label htmlFor="advisory-add-lrn">LRN</Label>
            <Input
              id="advisory-add-lrn"
              value={addLrn}
              onChange={(e) => {
                // Digits only — a DepEd LRN is exactly 12 numbers.
                setAddLrn(e.target.value.replace(/\D/g, "").slice(0, 12));
                setAddError(null);
              }}
              placeholder="12-digit LRN"
              inputMode="numeric"
              pattern="[0-9]{12}"
              autoComplete="off"
              maxLength={12}
            />
          </div>
          {advisorySections.length > 1 ? (
            <div className="flex min-w-0 flex-col gap-1.5">
              <Label htmlFor="advisory-add-section">Section</Label>
              <Select value={addSectionId} onValueChange={setAddSectionId}>
                <SelectTrigger id="advisory-add-section" className="w-full">
                  <SelectValue placeholder="Pick a section" />
                </SelectTrigger>
                <SelectContent>
                  {advisorySections.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
          {addError ? (
            <p role="alert" className="text-sm text-destructive">
              {addError}
            </p>
          ) : null}
        </div>
      </KanbanOverlay>

      <KanbanOverlay
        open={editOpen && editTarget !== null}
        onClose={() => {
          if (!editSaving) setEditOpen(false);
        }}
        dismissable={!editSaving}
        busy={editSaving}
        width="sm"
        title="Edit student"
        icon={
          <span className="text-primary" aria-hidden>
            <Pencil size={14} />
          </span>
        }
        description="Correct the learner's name or LRN. The LRN stays 12 digits, numbers only."
        footer={
          <div className="flex items-center justify-end gap-1.5 px-1 pb-1">
            <Button
              type="button"
              size="sm"
              className="h-6 px-3 text-xs"
              onClick={() => void handleEditStudent()}
              disabled={editSaving}
              aria-busy={editSaving || undefined}
              autoFocus
            >
              {editSaving ? (
                <>
                  <Loader2 size={14} className="animate-spin" aria-hidden />
                  <span aria-live="polite">Saving…</span>
                </>
              ) : (
                "Save changes"
              )}
            </Button>
          </div>
        }
      >
        <div className="flex min-w-0 flex-col gap-3 px-1">
          <div className="flex min-w-0 flex-col gap-1.5">
            <Label htmlFor="advisory-edit-name">Full name</Label>
            <Input
              id="advisory-edit-name"
              value={editName}
              onChange={(e) => {
                setEditName(e.target.value);
                setEditError(null);
              }}
              placeholder="e.g. Juan Garcia"
              maxLength={120}
            />
          </div>
          <div className="flex min-w-0 flex-col gap-1.5">
            <Label htmlFor="advisory-edit-lrn">LRN</Label>
            <Input
              id="advisory-edit-lrn"
              value={editLrn}
              onChange={(e) => {
                // Digits only — a DepEd LRN is exactly 12 numbers.
                setEditLrn(e.target.value.replace(/\D/g, "").slice(0, 12));
                setEditError(null);
              }}
              placeholder="12-digit LRN"
              inputMode="numeric"
              pattern="[0-9]{12}"
              autoComplete="off"
              maxLength={12}
            />
          </div>
          {editTarget?.hasAccount ? (
            <p className="text-xs text-muted-foreground">
              This learner has an account — the name and LRN on it change too.
            </p>
          ) : null}
          {editError ? (
            <p role="alert" className="text-sm text-destructive">
              {editError}
            </p>
          ) : null}
        </div>
      </KanbanOverlay>

    </section>
  );
}
