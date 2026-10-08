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
  type VisibilityState
} from "@tanstack/react-table";
import {
  ChevronDown,
  ColumnsIcon,
  SearchIcon,
  Trash2,
  Download,
  Copy,
  FileText,
} from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent
} from "@dnd-kit/core";
import { restrictToHorizontalAxis } from "@dnd-kit/modifiers";
import {
  arrayMove,
  SortableContext,
  horizontalListSortingStrategy
} from "@dnd-kit/sortable";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { InputGroup, InputGroupInput, InputGroupAddon } from "@/components/ui/input-group";
import { baseColumns, initialData, type Payment } from "./data-table-columns";
import { DragAlongCell, DraggableHeader } from "./data-table-drag-cells";
export type { Payment };
export default function DataTableDemo() {
  const [data] = React.useState<Payment[]>(initialData);
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = React.useState({});
  const [columnOrder, setColumnOrder] = React.useState<string[]>(() =>
    baseColumns
      .map((col) => (col.id || ("accessorKey" in col ? col.accessorKey : null)) as string)
      .filter((id) => id && id !== "select" && id !== "actions")
  );
  const sortableId = React.useId();
  const sensors = useSensors(
    useSensor(MouseSensor, {}),
    useSensor(TouchSensor, {}),
    useSensor(KeyboardSensor, {})
  );
  const columns = React.useMemo<ColumnDef<Payment>[]>(() => {
    const selectColumn = baseColumns.find((col) => col.id === "select");
    const actionsColumn = baseColumns.find((col) => col.id === "actions");
    const otherColumns = columnOrder
      .map((colId) =>
        baseColumns.find(
          (col) => col.id === colId || ("accessorKey" in col && col.accessorKey === colId)
        )
      )
      .filter((col): col is ColumnDef<Payment> => col !== undefined);
    const result: ColumnDef<Payment>[] = [];
    if (selectColumn) result.push(selectColumn);
    result.push(...otherColumns);
    if (actionsColumn) result.push(actionsColumn);
    return result;
  }, [columnOrder]);
  const fullColumnOrder = React.useMemo<string[]>(() => {
    return ["select", ...columnOrder, "actions"];
  }, [columnOrder]);
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
      const filteredOrder = newOrder.filter((id: string) => id !== "select" && id !== "actions");
      setColumnOrder(filteredOrder);
    },
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      columnOrder: fullColumnOrder
    }
  });
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
  return (
    <div className="w-full max-w-6xl space-y-4">
      <div className="flex items-center gap-2">
        <InputGroup>
          <InputGroupInput
            placeholder="Filter emails..."
            value={(table.getColumn("email")?.getFilterValue() as string) ?? ""}
            onChange={(event) => table.getColumn("email")?.setFilterValue(event.target.value)}
          />
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
        </InputGroup>
        <div className="ml-auto flex items-center gap-2">
          {table.getFilteredSelectedRowModel().rows.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  Actions
                  <ChevronDown />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>
                  {table.getFilteredSelectedRowModel().rows.length} selected
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <Copy />
                  Copy selected IDs
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <FileText />
                  Copy as JSON
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <Download />
                  Export as CSV
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive focus:text-destructive">
                  <Trash2 />
                  Delete selected
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
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
                      onCheckedChange={(value) => column.toggleVisibility(!!value)}>
                      {column.id}
                    </DropdownMenuCheckboxItem>
                  );
                })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <div className="overflow-hidden rounded-md border">
        <DndContext
          id={sortableId}
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToHorizontalAxis]}
          onDragEnd={handleDragEnd}>
          <Table>
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
                    No results.
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
            disabled={!table.getCanPreviousPage()}>
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}>
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
