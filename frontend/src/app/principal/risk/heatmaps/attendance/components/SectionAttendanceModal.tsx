"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  flexRender,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { ArrowLeft, Search } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { CardModal } from "@/components/ui/CardModal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SortTh, TablePager } from "./heatmap-table";
import common from "./heatmap-table.module.css";
import styles from "./SectionAttendanceModal.module.css";

export interface SectionSelection {
  sectionId: string;
  sectionName: string;
}

interface SectionOption {
  sectionId: string;
  section: string;
  gradeLevel: string;
  enrolled: number;
  rate: number;
}

interface SectionStudent {
  id: string;
  lrn: string;
  name: string;
  present: number;
  late: number;
  absent: number;
  excused: number;
  rate: number;
}

const PAGE_SIZE = 12;

const gradeNum = (name: string) => {
  const m = String(name).match(/(\d+)/);
  if (!m) return 0;
  const n = parseInt(m[1], 10);
  return Number.isNaN(n) ? 0 : n;
};

export function SectionAttendanceModal({
  open,
  selection,
  onPick,
  onBack,
  onClose,
}: {
  open: boolean;
  selection: SectionSelection | null;
  onPick: (selection: SectionSelection) => void;
  onBack: () => void;
  onClose: () => void;
}) {
  const [pickerQuery, setPickerQuery] = React.useState("");
  const [studentQuery, setStudentQuery] = React.useState("");
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [pageIndex, setPageIndex] = React.useState(0);

  // Picker mode (no section chosen yet): every section in the school.
  const sectionsQuery = useQuery({
    queryKey: ["attendance-modal-sections"],
    queryFn: async () => {
      const res = await apiClient.get<{
        sections: SectionOption[];
      }>("/api/attendance/section-stats");
      return res.data;
    },
    enabled: open && !selection,
    staleTime: 30_000,
  });

  const studentsQuery = useQuery({
    queryKey: ["attendance-modal-students", selection?.sectionId],
    queryFn: async () => {
      const res = await apiClient.get<{
        section: string;
        schoolDays: number;
        students: SectionStudent[];
      }>(`/api/attendance/sections/${selection?.sectionId}/students`);
      return res.data;
    },
    enabled: open && !!selection,
    staleTime: 30_000,
  });

  // Reset table state whenever the drilled section changes.
  React.useEffect(() => {
    setStudentQuery("");
    setSorting([]);
    setPageIndex(0);
  }, [selection?.sectionId]);

  const options = React.useMemo(() => {
    const q = pickerQuery.trim().toLowerCase();
    const list = sectionsQuery.data?.sections ?? [];
    const filtered = q
      ? list.filter(
          (s) =>
            s.section.toLowerCase().includes(q) ||
            `grade ${s.gradeLevel}`.includes(q)
        )
      : list;
    return [...filtered].sort(
      (a, b) => gradeNum(a.section) - gradeNum(b.section) || a.section.localeCompare(b.section)
    );
  }, [sectionsQuery.data, pickerQuery]);

  const allStudents = React.useMemo(
    () => studentsQuery.data?.students ?? [],
    [studentsQuery.data]
  );
  const schoolDays = studentsQuery.data?.schoolDays ?? 0;

  const filtered = React.useMemo(() => {
    const q = studentQuery.trim().toLowerCase();
    if (!q) return allStudents;
    return allStudents.filter(
      (s) =>
        s.name.toLowerCase().includes(q) || s.lrn.toLowerCase().includes(q)
    );
  }, [allStudents, studentQuery]);

  const columns = React.useMemo<ColumnDef<SectionStudent>[]>(
    () => [
      {
        id: "name",
        accessorFn: (row) => row.name,
        header: "Student",
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className={common.cellMain}>{row.original.name}</p>
            <p className={common.cellSub}>{row.original.lrn}</p>
          </div>
        ),
      },
      {
        id: "present",
        accessorFn: (row) => row.present,
        header: "Pres",
        cell: ({ row }) => (
          <span className={common.mono}>{row.original.present}</span>
        ),
      },
      {
        id: "late",
        accessorFn: (row) => row.late,
        header: "Late",
        cell: ({ row }) => (
          <span className={common.mono}>{row.original.late}</span>
        ),
      },
      {
        id: "absent",
        accessorFn: (row) => row.absent,
        header: "Abs",
        cell: ({ row }) => (
          <span className={common.mono}>{row.original.absent}</span>
        ),
      },
      {
        id: "excused",
        accessorFn: (row) => row.excused,
        header: "Exc",
        cell: ({ row }) => (
          <span className={common.mono}>{row.original.excused}</span>
        ),
      },
      {
        id: "rate",
        accessorFn: (row) => row.rate,
        header: "Rate",
        cell: ({ row }) => (
          <Badge
            variant={row.original.rate < 80 ? "destructive" : "outline"}
            className={common.rateBadge}
          >
            {row.original.rate}%
          </Badge>
        ),
      },
    ],
    []
  );

  const table = useReactTable({
    data: filtered,
    columns,
    getRowId: (row) => row.id,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    initialState: { pagination: { pageSize: PAGE_SIZE } },
    state: { sorting, pagination: { pageIndex, pageSize: PAGE_SIZE } },
    onPaginationChange: (updater) => {
      const next =
        typeof updater === "function"
          ? updater({ pageIndex, pageSize: PAGE_SIZE })
          : updater;
      setPageIndex(next.pageIndex);
    },
  });

  const pageCount = table.getPageCount();
  const safePageIndex = Math.min(pageIndex, Math.max(0, pageCount - 1));
  const rows = table.getRowModel().rows;
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(safePageIndex + 1, totalPages);
  const start = total === 0 ? 0 : safePageIndex * PAGE_SIZE + 1;
  const end = Math.min((safePageIndex + 1) * PAGE_SIZE, total);

  return (
    <CardModal
      open={open}
      onClose={onClose}
      size="lg"
      title={
        selection
          ? `Section attendance · ${selection.sectionName}`
          : "Drill into a section"
      }
      description={
        selection
          ? `Per-student daily breakdown — present means present in every subject offered that day. ${schoolDays} school days. Read-only.`
          : `Pick a section to see its full per-student daily table. Read-only.`
      }
      watchKey={selection?.sectionId ?? "picker"}
    >
      {!selection ? (
        <>
          <div className={common.searchWrap} style={{ marginBottom: "0.75rem" }}>
            <Search className={common.searchIcon} aria-hidden />
            <Input
              className={common.search}
              style={{ height: "2rem" }}
              placeholder="Search sections…"
              value={pickerQuery}
              onChange={(e) => setPickerQuery(e.target.value)}
              aria-label="Search sections"
            />
          </div>
          {sectionsQuery.isPending ? (
            <ul className={styles.picker} aria-hidden>
              {Array.from({ length: 5 }).map((_, i) => (
                <li key={i}>
                  <Skeleton className={styles.skelPick} />
                </li>
              ))}
            </ul>
          ) : sectionsQuery.isError ? (
            <p className={common.empty}>
              Could not load sections. Close and try again.
            </p>
          ) : options.length === 0 ? (
            <p className={common.empty}>
              {pickerQuery.trim()
                ? `No sections match “${pickerQuery}”.`
                : "No sections available."}
            </p>
          ) : (
            <ul className={styles.picker}>
              {options.map((s) => (
                <li key={s.sectionId}>
                  <button
                    type="button"
                    className={styles.pickBtn}
                    onClick={() =>
                      onPick({ sectionId: s.sectionId, sectionName: s.section })
                    }
                    aria-label={`Show attendance for ${s.section}`}
                  >
                    <span className={styles.pickIdentity}>
                      <span className={styles.pickName}>{s.section}</span>
                      <span className={styles.pickMeta}>
                        Grade {s.gradeLevel} · {s.enrolled} students
                      </span>
                    </span>
                    <Badge
                      variant={s.rate < 80 ? "destructive" : "outline"}
                      className={common.rateBadge}
                    >
                      {s.rate}%
                    </Badge>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <>
          <div className={styles.topRow}>
            <Button variant="ghost" size="sm" onClick={onBack}>
              <ArrowLeft aria-hidden />
              All sections
            </Button>
            <p className={styles.meta}>
              {total} student{total === 1 ? "" : "s"}
            </p>
          </div>
          <div className={common.searchWrap} style={{ marginBottom: "0.75rem" }}>
            <Search className={common.searchIcon} aria-hidden />
            <Input
              className={common.search}
              style={{ height: "2rem" }}
              placeholder="Search name or LRN…"
              value={studentQuery}
              onChange={(e) => {
                setStudentQuery(e.target.value);
                setPageIndex(0);
              }}
              aria-label="Search students in this section"
            />
          </div>
          {studentsQuery.isPending ? (
            <div className={common.tableWrap}>
              <Table aria-label="Section students">
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Rate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.from({ length: 6 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <Skeleton className={styles.skelRow} />
                      </TableCell>
                      <TableCell>
                        <Skeleton className={styles.skelRow} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : studentsQuery.isError ? (
            <p className={common.empty}>
              Could not load the students in this section.
            </p>
          ) : filtered.length === 0 ? (
            <p className={common.empty}>
              {studentQuery.trim()
                ? `No students match “${studentQuery}”.`
                : "No students in this section."}
            </p>
          ) : (
            <>
              <div className={common.tableWrap}>
                <Table aria-label={`Students in ${selection.sectionName}`}>
                  <TableHeader>
                    {table.getHeaderGroups().map((headerGroup) => (
                      <TableRow key={headerGroup.id}>
                        {headerGroup.headers.map((header) => (
                          <TableHead key={header.id}>
                            {header.isPlaceholder
                              ? null
                              : header.column.getCanSort()
                                ? (
                                  <SortTh
                                    label={String(
                                      flexRender(
                                        header.column.columnDef.header,
                                        header.getContext()
                                      )
                                    )}
                                    sorted={header.column.getIsSorted()}
                                    onToggle={header.column.getToggleSortingHandler() ?? (() => {})}
                                  />
                                )
                                : (
                                  flexRender(
                                    header.column.columnDef.header,
                                    header.getContext()
                                  )
                                )}
                          </TableHead>
                        ))}
                      </TableRow>
                    ))}
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => (
                      <TableRow key={row.id}>
                        {row.getVisibleCells().map((cell) => (
                          <TableCell key={cell.id}>
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext()
                            )}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <TablePager
                start={start}
                end={end}
                total={total}
                page={safePage}
                totalPages={totalPages}
                canPrev={table.getCanPreviousPage()}
                canNext={table.getCanNextPage()}
                onPrev={() => setPageIndex((p) => Math.max(0, p - 1))}
                onNext={() => setPageIndex((p) => p + 1)}
                label="students"
              />
            </>
          )}
        </>
      )}
    </CardModal>
  );
}
