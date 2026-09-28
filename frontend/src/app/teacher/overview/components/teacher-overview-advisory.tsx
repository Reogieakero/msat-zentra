"use client";

import * as React from "react";
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
  BookOpen,
  CalendarClock,
  ChevronDown,
  ColumnsIcon,
  MoreHorizontal,
  SearchIcon,
  ShieldAlert,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
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
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { InputGroup, InputGroupInput, InputGroupAddon } from "@/components/ui/input-group";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { DragAlongCell, DraggableHeader } from "@/components/data-table/drag-columns";
import { riskBadgeVariant } from "@/lib/risk/status";
import type { AdvisoryStatusRow } from "./teacher-overview-data";
import styles from "./teacher-overview-advisory.module.css";

type StatusFilter = "" | AdvisoryStatusRow["riskLevel"];

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "", label: "All statuses" },
  { value: "Low", label: "Low" },
  { value: "Moderate", label: "Moderate" },
  { value: "High", label: "High" },
];

interface StatusBadgeProps {
  level: AdvisoryStatusRow["riskLevel"];
}

export function StatusBadge({ level }: StatusBadgeProps) {
  return <Badge variant={riskBadgeVariant(level)}>{level}</Badge>;
}

interface FlagBadgeProps {
  flag: AdvisoryStatusRow["flag"];
  flags?: AdvisoryStatusRow["flags"];
}

const FLAG_ICONS = {
  academic: BookOpen,
  attendance: CalendarClock,
  behavioral: ShieldAlert,
} as const;

export function FlagBadge({ flag, flags }: FlagBadgeProps) {
  const active = flags && flags.length > 0 ? flags : flag === "none" ? [] : [flag];
  if (active.length === 0) return null;
  return (
    <span className={styles.flagList}>
      {active.map((f) => {
        const Icon = FLAG_ICONS[f];
        return (
          <span key={f} className={styles.flagBadge}>
            <Icon aria-hidden />
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </span>
        );
      })}
    </span>
  );
}

const baseColumns: ColumnDef<AdvisoryStatusRow>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
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
      <div className="min-w-0">
        <p className={styles.cellMain}>{row.getValue("name")}</p>
        <p className={styles.cellSub}>{row.original.section}</p>
      </div>
    ),
  },
  {
    accessorKey: "riskLevel",
    header: "Status",
    size: 130,
    minSize: 110,
    cell: ({ row }) => <StatusBadge level={row.getValue("riskLevel")} />,
  },
  {
    accessorKey: "flag",
    header: "Flag",
    size: 200,
    minSize: 140,
    cell: ({ row }) => <FlagBadge flag={row.getValue("flag")} flags={row.original.flags} />,
  },
  {
    id: "actions",
    enableHiding: false,
    header: () => <div className="text-end">Actions</div>,
    cell: ({ row, table }) => {
      const s = row.original;
      return (
        <div className="text-end">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8">
                <MoreHorizontal aria-hidden />
                <span className="sr-only">Open menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>{s.name}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => table.getColumn("name")?.setFilterValue(s.name)}
              >
                Filter by name
              </DropdownMenuItem>
              <DropdownMenuItem disabled>View student profile</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      );
    },
  },
];

interface TeacherOverviewAdvisoryProps {
  students: AdvisoryStatusRow[];
}

/* Advisory-students card as a data table (data-table5 pattern: sortable +
   draggable columns, name/status filters, column visibility, row
   selection, pagination). Header keeps the title, privacy note, and the
   status count. */
export function TeacherOverviewAdvisory({ students }: TeacherOverviewAdvisoryProps) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = React.useState({});
  const [columnOrder, setColumnOrder] = React.useState<string[]>(() => [
    "name",
    "riskLevel",
    "flag",
  ]);
  const [status, setStatus] = React.useState<StatusFilter>("");
  const sortableId = React.useId();

  const sensors = useSensors(
    useSensor(MouseSensor, {}),
    useSensor(TouchSensor, {}),
    useSensor(KeyboardSensor, {}),
  );

  const columns = React.useMemo<ColumnDef<AdvisoryStatusRow>[]>(() => {
    const selectColumn = baseColumns.find((col) => col.id === "select");
    const actionsColumn = baseColumns.find((col) => col.id === "actions");
    const otherColumns = columnOrder
      .map((colId) =>
        baseColumns.find(
          (col) => col.id === colId || ("accessorKey" in col && col.accessorKey === colId),
        ),
      )
      .filter((col): col is ColumnDef<AdvisoryStatusRow> => col !== undefined);
    const result: ColumnDef<AdvisoryStatusRow>[] = [];
    if (selectColumn) result.push(selectColumn);
    result.push(...otherColumns);
    if (actionsColumn) result.push(actionsColumn);
    return result;
  }, [columnOrder]);

  const fullColumnOrder = React.useMemo<string[]>(
    () => ["select", ...columnOrder, "actions"],
    [columnOrder],
  );

  const table = useReactTable({
    data: students,
    columns,
    columnResizeMode: "onChange",
    getRowId: (row) => row.studentId,
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
      setColumnOrder(newOrder.filter((id: string) => id !== "select" && id !== "actions"));
    },
    initialState: { pagination: { pageSize: 10 } },
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      columnOrder: fullColumnOrder,
    },
  });

  // Keep the status dropdown and the table column filter in sync.
  const setStatusFilter = (next: StatusFilter) => {
    setStatus(next);
    table.getColumn("riskLevel")?.setFilterValue(next === "" ? undefined : next);
  };

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (
      active &&
      over &&
      active.id !== over.id &&
      active.id !== "select" &&
      active.id !== "actions" &&
      over.id !== "select" &&
      over.id !== "actions"
    ) {
      setColumnOrder((order) => {
        const oldIndex = order.indexOf(active.id as string);
        const newIndex = order.indexOf(over.id as string);
        return arrayMove(order, oldIndex, newIndex);
      });
    }
  }

  const statusLabel = STATUS_OPTIONS.find((o) => o.value === status)?.label ?? "All statuses";
  const hasRows = students.length > 0;

  return (
    <Card className={styles.card} aria-label="Advisory students">
      <CardHeader className={styles.header}>
        <div className={styles.headerText}>
          <h2 className={styles.sectionTitle}>Advisory Students</h2>
          <p className={styles.sectionDesc}>
            Status for your advisees — {students.length} student{students.length === 1 ? "" : "s"}.
            Category only, never the private write-up.
          </p>
        </div>
        {hasRows && (
          <CardAction className={styles.headerActions}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  style={{ height: "2rem" }}
                  aria-label={`Filter students by status, currently showing: ${statusLabel}`}
                  className={`${styles.filterBtn} ${status !== "" ? styles.filterActive : ""}`}
                >
                  {status === "" ? "Status" : statusLabel}
                  {status !== "" && <span className={styles.filterDot} aria-hidden />}
                  <ChevronDown aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className={styles.filterMenu}>
                {STATUS_OPTIONS.map((item) => (
                  <DropdownMenuCheckboxItem
                    key={item.label}
                    checked={status === item.value}
                    onCheckedChange={() => setStatusFilter(item.value)}
                  >
                    {item.label}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </CardAction>
        )}
      </CardHeader>
      <CardContent className={styles.content}>
        {!hasRows ? (
          <p className={styles.empty}>No advisory students.</p>
        ) : (
          <div className="w-full min-w-0 space-y-4">
            <div className="flex items-center gap-2">
              <InputGroup className="max-w-56">
                <InputGroupInput
                  placeholder="Filter students..."
                  value={(table.getColumn("name")?.getFilterValue() as string) ?? ""}
                  onChange={(event) =>
                    table.getColumn("name")?.setFilterValue(event.target.value)
                  }
                />
                <InputGroupAddon>
                  <SearchIcon />
                </InputGroupAddon>
              </InputGroup>
              <div className="ml-auto flex items-center gap-2">
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
            <div className="overflow-x-auto rounded-md border">
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
                        <TableCell colSpan={columns.length} className="h-24 text-center">
                          No students match your search and filters.
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
          </div>
        )}
      </CardContent>
    </Card>
  );
}
