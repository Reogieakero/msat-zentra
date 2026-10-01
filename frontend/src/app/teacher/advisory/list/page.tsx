"use client";

import * as React from "react";
import Link from "next/link";
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
import { Archive, Loader2, MoreHorizontal, RotateCcw, SearchIcon, Users } from "lucide-react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { useSession } from "@/lib/auth/useSession";
import { markSelfNotified } from "@/lib/realtime/teacherChannel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/app/teacher/overview/components/teacher-overview-advisory";
import {
  advisoryRosterKey,
  archivedRosterKey,
  fetchArchivedRoster,
  useAdvisoryRoster,
  type AdviseeRow,
  type AdviseeRiskFlag,
  type AdvisoryRoster,
} from "../students/components/advisory-students-data";
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";
import styles from "@/app/teacher/overview/components/teacher-overview-advisory.module.css";
import listStyles from "./components/advisory-list.module.css";

// Factor badges — same mapping as the overview At-Risk Advisees table:
// academic amber, attendance green, behavioral blue.
const FACTOR_BADGE: Record<AdviseeRiskFlag, { variant: "amber" | "green" | "blue"; label: string }> = {
  academic: { variant: "amber", label: "Academic" },
  attendance: { variant: "green", label: "Attendance" },
  behavioral: { variant: "blue", label: "Behavioral" },
};

function FactorBadges({ flags }: { flags?: AdviseeRiskFlag[] }) {
  const active = (flags ?? []).filter((f) => f in FACTOR_BADGE);
  if (active.length === 0) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {active.map((f) => (
        <Badge key={f} variant={FACTOR_BADGE[f].variant}>
          {FACTOR_BADGE[f].label}
        </Badge>
      ))}
    </span>
  );
}

function getErrorMessage(err: unknown, fallback: string): string {
  const data = (err as { response?: { data?: { error?: { message?: unknown }; message?: unknown } } })?.response?.data;
  const message = data?.error?.message ?? data?.message;
  if (typeof message === "string" && message) return message;
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

/* Advisory List — the adviser's own student roster as a data table, same
   layout as the overview At-Risk Advisees table: section card, title + count
   header with the filter on the right, fixed table, count + pager footer.
   Names link to each advisee's academic record. Rows soft-delete (archive)
   and restore with full record history; an Archived view lists the hidden. */
export default function TeacherAdvisoryListPage() {
  const rosterQuery = useAdvisoryRoster();
  const session = useSession();
  const queryClient = useQueryClient();
  const rosterKey = advisoryRosterKey(session?.sub);
  const archivedKey = archivedRosterKey(session?.sub);
  const [showArchived, setShowArchived] = React.useState(false);
  // Archived list loads lazily (only when opened) and holds the previous
  // view while refetching — switching feels instant. The toggle count comes
  // from the main roster payload, so no fetch is needed to show it.
  const archivedQuery = useQuery({
    queryKey: archivedKey,
    queryFn: fetchArchivedRoster,
    enabled: !!session?.sub && showArchived,
    retry: false,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    placeholderData: keepPreviousData,
  });
  const activeStudents = React.useMemo(
    () => rosterQuery.data?.students ?? [],
    [rosterQuery.data],
  );
  const archivedStudents = React.useMemo(
    () => archivedQuery.data?.students ?? [],
    [archivedQuery.data],
  );
  const students = showArchived ? archivedStudents : activeStudents;
  const archivedTotal = rosterQuery.data?.archivedCount ?? archivedStudents.length;
  const sectionLabel = React.useMemo(
    () => (rosterQuery.data?.advisorySections ?? []).map((s) => s.name).join(", "),
    [rosterQuery.data],
  );

  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [archiveTarget, setArchiveTarget] = React.useState<AdviseeRow | null>(null);
  const [archiveError, setArchiveError] = React.useState<string | null>(null);

  function moveRow(row: AdviseeRow, fromKey: readonly unknown[], toKey: readonly unknown[]) {
    const from = queryClient.getQueryData<AdvisoryRoster>(fromKey);
    if (from) {
      queryClient.setQueryData<AdvisoryRoster>(fromKey, {
        ...from,
        students: from.students.filter((s) => s.studentId !== row.studentId),
      });
    }
    const to = queryClient.getQueryData<AdvisoryRoster>(toKey);
    if (to) {
      queryClient.setQueryData<AdvisoryRoster>(toKey, {
        ...to,
        students: [row, ...to.students],
      });
    }
  }

  function bumpArchivedCount(delta: 1 | -1) {
    const current = queryClient.getQueryData<AdvisoryRoster>(rosterKey);
    if (current) {
      queryClient.setQueryData<AdvisoryRoster>(rosterKey, {
        ...current,
        archivedCount: Math.max(0, (current.archivedCount ?? 0) + delta),
      });
    }
  }

  // Archive: row leaves the list instantly; rollback on failure.
  const archiveMutation = useMutation({
    mutationFn: async (row: AdviseeRow) => {
      const { data } = await apiClient.post<{ id?: string }>("/api/teacher/advisory/students/archive", {
        studentId: row.studentId,
      });
      return { data, row };
    },
    onMutate: async (row) => {
      await queryClient.cancelQueries({ queryKey: rosterKey });
      await queryClient.cancelQueries({ queryKey: archivedKey });
      const prevActive = queryClient.getQueryData<AdvisoryRoster>(rosterKey);
      const prevArchived = queryClient.getQueryData<AdvisoryRoster>(archivedKey);
      moveRow(row, rosterKey, archivedKey);
      bumpArchivedCount(1);
      return { prevActive, prevArchived };
    },
    onError: (err, _row, context) => {
      if (context?.prevActive) queryClient.setQueryData(rosterKey, context.prevActive);
      if (context?.prevArchived) queryClient.setQueryData(archivedKey, context.prevArchived);
      const message = getErrorMessage(err, "Could not archive this student.");
      setArchiveError(message);
      toast.error({ title: "Could not archive student", description: message });
    },
    onSuccess: ({ data }) => {
      if (data?.id) markSelfNotified(data.id);
      setArchiveTarget(null);
      setArchiveError(null);
      toast.success({
        title: "Student archived",
        description: "Removed from your list. Records are kept.",
      });
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: rosterKey });
      void queryClient.invalidateQueries({ queryKey: archivedKey });
    },
  });

  // Restore: row returns with full history; rollback on failure.
  const restoreMutation = useMutation({
    mutationFn: async (row: AdviseeRow) => {
      const { data } = await apiClient.post("/api/teacher/advisory/students/restore", {
        studentId: row.studentId,
      });
      return { data, row };
    },
    onMutate: async (row) => {
      await queryClient.cancelQueries({ queryKey: rosterKey });
      await queryClient.cancelQueries({ queryKey: archivedKey });
      const prevActive = queryClient.getQueryData<AdvisoryRoster>(rosterKey);
      const prevArchived = queryClient.getQueryData<AdvisoryRoster>(archivedKey);
      moveRow(row, archivedKey, rosterKey);
      bumpArchivedCount(-1);
      return { prevActive, prevArchived };
    },
    onError: (err, _row, context) => {
      if (context?.prevActive) queryClient.setQueryData(rosterKey, context.prevActive);
      if (context?.prevArchived) queryClient.setQueryData(archivedKey, context.prevArchived);
      const message = getErrorMessage(err, "Could not restore this student.");
      toast.error({ title: "Could not restore student", description: message });
    },
    onSuccess: (_data, row) => {
      // Backend restore fanout uses the raw student key as sourceId.
      markSelfNotified(row.studentId);
      toast.success({
        title: "Student restored",
        description: `${row.name} is back with full history.`,
      });
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: rosterKey });
      void queryClient.invalidateQueries({ queryKey: archivedKey });
    },
  });

  function confirmArchive() {
    if (!archiveTarget || archiveMutation.isPending) return;
    setArchiveError(null);
    archiveMutation.mutate(archiveTarget);
  }

  const columns = React.useMemo<ColumnDef<AdviseeRow>[]>(
    () => [
      {
        id: "name",
        accessorFn: (row) => `${row.name} ${row.lrn}`,
        header: "Student",
        size: 220,
        minSize: 220,
        maxSize: 220,
        cell: ({ row }) => (
          <div className="min-w-0">
            <Link
              href={`/teacher/advisory/students/${row.original.studentId}/academic`}
              className="block truncate font-medium text-primary underline-offset-4 hover:underline"
            >
              {row.original.name}
            </Link>
            <p className={styles.cellSub}>{row.original.lrn}</p>
          </div>
        ),
      },
      {
        id: "riskLevel",
        accessorFn: (row) => row.riskLevel,
        header: "Risk",
        size: 130,
        minSize: 130,
        maxSize: 130,
        cell: ({ row }) => <StatusBadge level={row.original.riskLevel} />,
      },
      {
        id: "factors",
        accessorFn: (row) => (row.flags ?? []).join(" "),
        header: "Factors",
        size: 180,
        minSize: 180,
        maxSize: 180,
        enableSorting: false,
        cell: ({ row }) => <FactorBadges flags={row.original.flags} />,
      },
      {
        id: "section",
        accessorFn: (row) => row.section,
        header: "Section",
        size: 140,
        minSize: 140,
        maxSize: 140,
        cell: ({ row }) => (
          <span className="truncate text-muted-foreground">{row.original.section}</span>
        ),
      },
      {
        id: "actions",
        header: () => <div className="text-end">Actions</div>,
        size: 60,
        minSize: 60,
        maxSize: 60,
        enableSorting: false,
        cell: ({ row }) => {
          const r = row.original;
          return (
            <div className="text-end">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="size-8" aria-label={`Actions for ${r.name}`}>
                    <MoreHorizontal size={16} strokeWidth={1.8} aria-hidden />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="text-[14px]">
                  {showArchived ? (
                    <DropdownMenuItem
                      disabled={restoreMutation.isPending}
                      onSelect={() => restoreMutation.mutate(r)}
                    >
                      <RotateCcw size={16} strokeWidth={1.8} aria-hidden />
                      Restore
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem
                      onSelect={() => {
                        setArchiveTarget(r);
                        setArchiveError(null);
                      }}
                      className="text-destructive focus:text-destructive"
                    >
                      <Archive size={16} strokeWidth={1.8} aria-hidden />
                      Archive
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
      },
    ],
    [showArchived, restoreMutation],
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
    initialState: { pagination: { pageSize: 15 } },
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

  // Optimistic enlist: the row lands in the table instantly; the server
  // confirmation swaps it in behind, rollback on failure. No waiting.
  const enlistMutation = useMutation({
    mutationFn: async (payload: { fullName: string; lrn: string; sectionId?: string }) => {
      const { data } = await apiClient.post<{ studentId?: string }>("/api/teacher/advisory/roster", payload);
      return data;
    },
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey: rosterKey });
      const previous = queryClient.getQueryData<AdvisoryRoster>(rosterKey);
      const sectionName =
        advisorySections.find((s) => s.id === payload.sectionId)?.name ??
        advisorySections[0]?.name ??
        "";
      const temp: AdviseeRow = {
        studentId: `pending:${payload.lrn}`,
        name: payload.fullName,
        lrn: payload.lrn,
        birthdate: null,
        gender: null,
        section: sectionName,
        riskLevel: "Low",
        flags: [],
        attendanceRate: 1,
        anecdotalCount: 0,
        confidentialityTiers: [],
        hasOpenFlag: false,
        openFlagCount: 0,
        hasAccount: false,
        grades: [],
      };
      if (previous) {
        queryClient.setQueryData<AdvisoryRoster>(rosterKey, {
          ...previous,
          students: [temp, ...previous.students],
        });
      }
      return { previous };
    },
    onError: (err, _payload, context) => {
      if (context?.previous) queryClient.setQueryData(rosterKey, context.previous);
      const message = getErrorMessage(err, "Could not enlist this student.");
      setAddError(message);
      toast.error({ title: "Could not enlist student", description: message });
    },
    onSuccess: (data, payload) => {
      // Suppress the channel echo (success toast already fired) — the bell
      // row still lands for badge + instant list sync everywhere.
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
      void queryClient.invalidateQueries({ queryKey: rosterKey });
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
    // Close at once — the optimistic row is already in the table; the
    // server confirmation (or rollback + error toast) follows behind.
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
        <div className="flex flex-col gap-2" aria-busy="true" aria-label="Loading advisory list">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="h-10 rounded-md bg-muted" />
          ))}
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

  // Archived view needs its own fetch state; the active list's pending
  // branch above already covers first paint.
  const listPending = showArchived ? archivedQuery.isPending : false;

  return (
    <section aria-label="Advisory list" className="flex min-w-0 flex-col gap-3">
      {listPending ? (
        <div className="flex flex-col gap-2" aria-busy="true" aria-label="Loading archived students">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="h-10 rounded-md bg-muted" />
          ))}
        </div>
      ) : students.length === 0 ? (
        <div className={assign.card}>
          <span className={assign.glowClip} aria-hidden="true">
            <span className={assign.cardGlow} />
          </span>
          <div className="relative">
            <h2 className={styles.sectionTitle}>Advisory List</h2>
            <p className={styles.sectionDesc}>
              {showArchived
                ? "Archived advisees — 0 students. Records are kept."
                : `Your advisees — 0 students${sectionLabel ? ` · ${sectionLabel}` : ""}.`}
            </p>
          </div>
          <div className="relative flex flex-col items-center gap-2 py-6 text-center">
            <span
              className="flex h-12 w-12 items-center justify-center rounded-full bg-muted"
              aria-hidden="true"
            >
              {showArchived ? (
                <Archive size={24} className="text-muted-foreground" />
              ) : (
                <Users size={24} className="text-muted-foreground" />
              )}
            </span>
            <p className="font-medium">
              {showArchived ? "No archived students" : "No advisory students yet"}
            </p>
            <p className="max-w-sm text-sm text-muted-foreground">
              {showArchived
                ? "Students you archive land here — restore brings them back with full history."
                : "Students enlisted in your advisory section will appear here."}
            </p>
            {showArchived ? (
              <Button size="sm" className="mt-2" variant="outline" onClick={() => setShowArchived(false)}>
                Back to list
              </Button>
            ) : (
              <Button size="sm" className="mt-2" onClick={openAdd}>
                Add student
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className={listStyles.layout}>
          <div className="min-w-0">
        <div className={assign.card}>
          <span className={assign.glowClip} aria-hidden="true">
            <span className={assign.cardGlow} />
          </span>
          <div className="relative flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className={styles.sectionTitle}>Advisory List</h2>
              <p className={styles.sectionDesc}>
                {showArchived
                  ? `Archived advisees — ${students.length} student${students.length === 1 ? "" : "s"}. Records are kept.`
                  : `Your advisees — ${students.length} student${students.length === 1 ? "" : "s"}${sectionLabel ? ` · ${sectionLabel}` : ""}.`}
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
        </div>
          </div>
          <aside className={listStyles.sideList} aria-label="Roster actions">
            <div className={assign.card}>
              <span className={assign.glowClip} aria-hidden="true">
                <span className={assign.cardGlow} />
              </span>
              <div className="relative flex items-center gap-3">
                <span
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10"
                  aria-hidden="true"
                >
                  <Users size={20} className="text-primary" />
                </span>
                <div className="min-w-0">
                  <h2 className={styles.sectionTitle}>Add student</h2>
                  <p className={styles.sectionDesc}>
                    Enlist into your advisory.
                  </p>
                </div>
              </div>
              <div className="relative flex flex-col gap-2">
                <Button onClick={openAdd}>
                  Add student
                </Button>
              </div>
            </div>
            <div className={assign.card}>
              <span className={assign.glowClip} aria-hidden="true">
                <span className={assign.cardGlow} />
              </span>
              <div className="relative flex items-center gap-3">
                <span
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10"
                  aria-hidden="true"
                >
                  <Archive size={20} className="text-primary" />
                </span>
                <div className="min-w-0">
                  <h2 className={styles.sectionTitle}>Archived</h2>
                  <p className={styles.sectionDesc}>
                    {archivedTotal === 0
                      ? "Nothing archived."
                      : `${archivedTotal} archived student${archivedTotal === 1 ? "" : "s"}.`}
                  </p>
                </div>
              </div>
              <div className="relative flex flex-col gap-2">
                {showArchived ? (
                  <Button variant="outline" onClick={() => setShowArchived(false)}>
                    Back to list
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    onClick={() => setShowArchived(true)}
                    disabled={archivedTotal === 0}
                  >
                    View archived
                  </Button>
                )}
              </div>
            </div>
          </aside>
        </div>
      )}

      <Dialog
        open={addOpen}
        onOpenChange={(open) => {
          if (!open && !addSaving) setAddOpen(false);
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Add student</DialogTitle>
            <DialogDescription>
              Enlist a student into your advisory section
              {advisorySections.length === 1 && advisorySections[0]
                ? ` (${advisorySections[0].name})`
                : ""}
              .
            </DialogDescription>
          </DialogHeader>
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
          <DialogFooter>
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
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={archiveTarget !== null}
        onOpenChange={(open) => {
          if (!open && !archiveMutation.isPending) {
            setArchiveTarget(null);
            setArchiveError(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive this student?</AlertDialogTitle>
            <AlertDialogDescription>
              {archiveTarget ? (
                <>
                  {archiveTarget.name} will leave your advisory list. Grades,
                  attendance, anecdotal records, and referrals are kept —
                  restoring brings everything back.
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {archiveError ? (
            <p role="alert" className="text-sm text-destructive">
              {archiveError}
            </p>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel variant="destructive" disabled={archiveMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={archiveMutation.isPending}
              aria-busy={archiveMutation.isPending || undefined}
              onClick={(e) => {
                // Hold the dialog open for the flight: success clears the
                // target via the page; failure leaves it open with the error
                // shown so the adviser can retry.
                e.preventDefault();
                confirmArchive();
              }}
            >
              {archiveMutation.isPending ? (
                <>
                  <Loader2 size={16} className="animate-spin" aria-hidden />
                  <span aria-live="polite">Archiving…</span>
                </>
              ) : (
                "Archive"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
