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
import { KanbanSquare, Loader2, Plus, SearchIcon, Users } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { useTeacherInvalidate } from "../../components/use-teacher-invalidate";
import { markSelfNotified } from "@/lib/realtime/teacherChannel";
import { Button } from "@/components/ui/button";
import { CardModal } from "@/components/ui/CardModal";
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
import { StatusBadge } from "@/app/teacher/overview/components/teacher-overview-advisory";
import { Pagination } from "@/components/shared/pagination";
import { useAdvisoryRoster } from "@/services/teacher/advisory.service";
import type { AdviseeRow } from "@/services/teacher/advisory.types";
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
    () => rosterQuery.data?.students ?? [],
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
        id: "riskLevel",
        accessorFn: (row) => row.riskLevel,
        header: "Risk",
        size: 100,
        minSize: 90,
        maxSize: 120,
        cell: ({ row }) => <StatusBadge level={row.original.riskLevel} />,
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
      toast.error({ title: "Could not enlist student", description: message });
    },
    onSuccess: (data, payload) => {

      const rosterId = data?.studentId?.startsWith("roster:")
        ? data.studentId.slice("roster:".length)
        : undefined;
      if (rosterId) markSelfNotified(rosterId);
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
    setAddError(null);

    setAddOpen(false);
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
                  <Button size="sm" className="shrink-0" onClick={openAdd}>
                    <Plus size={14} aria-hidden />
                    Add student
                  </Button>
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
                            onClick={() => setSelectedId(row.original.studentId)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                setSelectedId(row.original.studentId);
                              }
                            }}
                            tabIndex={0}
                            aria-selected={isSelected}
                            aria-label={`${row.original.name}, ${row.original.riskLevel} risk — open insight`}
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
            <div className={listStyles.right} aria-label="Student insight">
              <AdvisoryInsightBoard student={selectedStudent} bare />
            </div>
          </div>
        </div>
      )}

      <CardModal
        open={addOpen}
        onClose={() => {
          if (!addSaving) setAddOpen(false);
        }}
        dismissable={!addSaving}
        size="sm"
        title="Add student"
        description={
          <>
            Enlist a student into your advisory section
            {advisorySections.length === 1 && advisorySections[0]
              ? ` (${advisorySections[0].name})`
              : ""}
            .
          </>
        }
      >
          <div className="flex min-w-0 flex-col gap-3">
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
                  setAddLrn(e.target.value);
                  setAddError(null);
                }}
                placeholder="12-digit LRN"
                maxLength={32}
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
          <div className="flex justify-end gap-2">
            <Button variant="destructive" onClick={() => setAddOpen(false)} disabled={addSaving}>
              Cancel
            </Button>
            <Button onClick={() => void handleAddStudent()} disabled={addSaving} aria-busy={addSaving || undefined}>
              {addSaving ? (
                <>
                  <Loader2 size={16} className="animate-spin" aria-hidden />
                  <span aria-live="polite">Enlisting…</span>
                </>
              ) : (
                "Enlist student"
              )}
            </Button>
          </div>
      </CardModal>

    </section>
  );
}
