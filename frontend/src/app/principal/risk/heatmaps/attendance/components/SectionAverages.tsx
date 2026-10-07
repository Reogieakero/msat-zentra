"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
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
import {
  ArrowDownRight,
  ArrowUpRight,
  Minus,
} from "lucide-react";
import { SearchIcon } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupInput, InputGroupAddon } from "@/components/ui/input-group";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { SectionAttendanceStat } from "../../components/types";
import { SortTh } from "./heatmap-table";
import common from "./heatmap-table.module.css";
import styles from "./SectionAverages.module.css";

const PAGE_SIZE = 15;

const TREND_RANK = { up: 2, flat: 1, down: 0 } as const;

function trendIcon(trend: SectionAttendanceStat["trend"]) {
  if (trend === "up")
    return <ArrowUpRight className={styles.trendUp} aria-label="Trending up" />;
  if (trend === "down")
    return (
      <ArrowDownRight className={styles.trendDown} aria-label="Trending down" />
    );
  return <Minus className={styles.trendFlat} aria-label="Steady" />;
}

export function SectionAverages({
  onInspectSection,
}: {
  onInspectSection: (sectionId: string, sectionName: string) => void;
}) {
  const { data, isPending } = useQuery({
    queryKey: ["attendance-section-averages"],
    queryFn: async () => {
      const res = await apiClient.get<{
        sections: SectionAttendanceStat[];
        schoolDays: number;
        totalEnrolled: number;
        term?: { id: string; termNumber: number };
      }>("/api/attendance/section-stats");
      return res.data;
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: false,
  });
  // Worst first — sections furthest below the 80% mark float to the top.
  const sections = React.useMemo(
    () => [...(data?.sections ?? [])].sort((a, b) => a.rate - b.rate),
    [data]
  );
  const below = sections.filter((s) => s.rate < 80).length;
  const maxBelow = Math.max(1, ...sections.map((s) => s.belowDays));

  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [pageIndex, setPageIndex] = React.useState(0);

  const columns = React.useMemo<ColumnDef<SectionAttendanceStat>[]>(
    () => [
      {
        id: "section",
        accessorFn: (row) => row.section,
        header: "Section",
        size: 220,
        minSize: 220,
        maxSize: 220,
        cell: ({ row }) => (
          <div className="min-w-0">
            <Button
              type="button"
              variant="link"
              size="sm"
              className={styles.sectionLink}
              onClick={() =>
                onInspectSection(row.original.sectionId, row.original.section)
              }
              aria-label={`Show per-student attendance for ${row.original.section}`}
            >
              {row.original.section}
            </Button>
            <span className={styles.gradeLevel}>
              Grade {row.original.gradeLevel}
            </span>
          </div>
        ),
      },
      {
        id: "enrolled",
        accessorFn: (row) => row.enrolled,
        header: "Enrolled",
        size: 110,
        minSize: 110,
        maxSize: 110,
        cell: ({ row }) => (
          <span className={common.mono}>{row.original.enrolled}</span>
        ),
      },
      {
        id: "rate",
        accessorFn: (row) => row.rate,
        header: "Attendance %",
        size: 150,
        minSize: 150,
        maxSize: 150,
        cell: ({ row }) => (
          <Badge
            variant={row.original.rate < 80 ? "destructive" : "outline"}
            className={common.rateBadge}
          >
            {row.original.rate}%
          </Badge>
        ),
      },
      {
        id: "below",
        accessorFn: (row) => row.belowDays,
        header: "Below 80%",
        size: 150,
        minSize: 150,
        maxSize: 150,
        cell: ({ row }) => (
          <span className={styles.belowCell}>
            <span className={styles.belowTrack} aria-hidden>
              <span
                className={styles.belowFill}
                style={{
                  width: `${(row.original.belowDays / maxBelow) * 100}%`,
                }}
              />
            </span>
            <span className={common.mono}>
              {row.original.belowDays} day{row.original.belowDays === 1 ? "" : "s"}
            </span>
          </span>
        ),
      },
      {
        id: "trend",
        accessorFn: (row) => TREND_RANK[row.trend],
        header: "Trend",
        size: 110,
        minSize: 110,
        maxSize: 110,
        cell: ({ row }) => trendIcon(row.original.trend),
      },
    ],
    [maxBelow, onInspectSection]
  );

  const table = useReactTable({
    data: sections,
    columns,
    getRowId: (row) => row.sectionId,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    initialState: { pagination: { pageSize: PAGE_SIZE } },
    state: { sorting, columnFilters, pagination: { pageIndex, pageSize: PAGE_SIZE } },
    onPaginationChange: (updater) => {
      const next =
        typeof updater === "function"
          ? updater({ pageIndex, pageSize: PAGE_SIZE })
          : updater;
      setPageIndex(next.pageIndex);
    },
  });

  const rows = table.getRowModel().rows;

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Section Averages</CardTitle>
          <CardDescription>
            Average present-per-day and how many days each section dipped below
            80%.
          </CardDescription>
        </div>
        <CardAction className="flex items-center gap-2">
          <InputGroup className="max-w-40 shrink-0">
            <InputGroupInput
              placeholder="Filter sections..."
              value={(table.getColumn("section")?.getFilterValue() as string) ?? ""}
              onChange={(event) => {
                table.getColumn("section")?.setFilterValue(event.target.value);
                setPageIndex(0);
              }}
              aria-label="Filter sections"
            />
            <InputGroupAddon>
              <SearchIcon />
            </InputGroupAddon>
          </InputGroup>
        </CardAction>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
      {isPending ? (
        <div className={styles.kpis}>
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className={styles.skelKpi} />
          ))}
        </div>
      ) : (
        <dl className={styles.kpis}>
          <div className={styles.kpi}>
            <dt>Total enrolled</dt>
            <dd>{data?.totalEnrolled ?? 0}</dd>
          </div>
          <div className={styles.kpi}>
            <dt>Sections tracked</dt>
            <dd>{sections.length}</dd>
          </div>
          <div className={styles.kpi}>
            <dt>Below 80%</dt>
            <dd>{below}</dd>
          </div>
          <div className={styles.kpi}>
            <dt>School days</dt>
            <dd>{data?.schoolDays ?? 0}</dd>
          </div>
        </dl>
      )}

      {isPending ? (
        <Skeleton className={styles.skelTable} />
      ) : sections.length === 0 ? (
        <p className={styles.empty}>No section data available.</p>
      ) : (
        <>
          <div className="relative overflow-x-auto rounded-md border">
            <Table aria-label="Section attendance averages" className="w-full table-fixed">
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id} className="bg-muted/50 [&>th]:border-t-0">
                    {headerGroup.headers.map((header) => (
                      <TableHead
                        key={header.id}
                        style={{ width: header.getSize() }}
                        className="h-10 truncate whitespace-nowrap select-none"
                      >
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
                                onToggle={
                                  header.column.getToggleSortingHandler() ??
                                  (() => {})
                                }
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
                {rows.length ? (
                  rows.map((row) => (
                    <TableRow
                      key={row.id}
                      className={
                        row.original.rate < 80 ? styles.badRow : undefined
                      }
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell
                          key={cell.id}
                          style={{ width: cell.column.getSize() }}
                          className="truncate"
                        >
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={columns.length} className="h-24 text-center">
                      No sections match your search.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <div className="relative flex items-center justify-end space-x-2">
            <div className="text-muted-foreground flex-1 text-sm">
              {table.getFilteredRowModel().rows.length} section
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
      </CardContent>
    </Card>
  );
}
