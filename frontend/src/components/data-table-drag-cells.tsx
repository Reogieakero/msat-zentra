"use client";
import type { CSSProperties } from "react";
import {
  flexRender,
  type Cell,
  type Header,
} from "@tanstack/react-table";
import {
  ArrowUpDown,
  GripVertical,
} from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import {
  TableCell,
  TableHead,
} from "@/components/ui/table";
import type { Payment } from "./data-table-columns";
export function DraggableHeader({ header }: { header: Header<Payment, unknown> }) {
  const isSelectColumn = header.column.id === "select";
  const isActionsColumn = header.column.id === "actions";
  const isNonDraggable = isSelectColumn || isActionsColumn;
  const { attributes, isDragging, listeners, setNodeRef, transform, transition } = useSortable({
    id: header.column.id,
    disabled: isNonDraggable
  });
  const style: CSSProperties = {
    opacity: isDragging ? 0.8 : 1,
    position: "relative",
    transform: CSS.Translate.toString(transform),
    transition,
    whiteSpace: "nowrap",
    width: header.column.getSize(),
    zIndex: isDragging ? 1 : 0
  };
  if (isNonDraggable) {
    return (
      <TableHead
        className="relative h-10 border-t"
        style={{ width: header.column.getSize() }}
        colSpan={header.colSpan}>
        <div className={isSelectColumn ? "flex items-center" : ""}>
          {header.isPlaceholder
            ? null
            : flexRender(header.column.columnDef.header, header.getContext())}
        </div>
      </TableHead>
    );
  }
  return (
    <TableHead
      ref={setNodeRef}
      className="relative h-10 border-t"
      style={style}
      colSpan={header.colSpan}>
      <div className="flex items-center justify-start gap-0.5">
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          {...attributes}
          {...listeners}
          aria-label="Drag to reorder">
          <GripVertical className="h-3 w-3 opacity-60" aria-hidden="true" />
        </Button>
        {header.column.getCanSort() && (
          <Button
            size="icon"
            variant="ghost"
            className="group h-7 w-7"
            onClick={header.column.getToggleSortingHandler()}
            aria-label="Toggle sorting">
            <ArrowUpDown className="h-4 w-4 shrink-0 opacity-60" aria-hidden="true" />
          </Button>
        )}
        <span className="ms-1 grow truncate">
          {header.isPlaceholder
            ? null
            : flexRender(header.column.columnDef.header, header.getContext())}
        </span>
      </div>
    </TableHead>
  );
}
export function DragAlongCell({ cell }: { cell: Cell<Payment, unknown> }) {
  const isSelectColumn = cell.column.id === "select";
  const isActionsColumn = cell.column.id === "actions";
  const isNonDraggable = isSelectColumn || isActionsColumn;
  const { isDragging, setNodeRef, transform, transition } = useSortable({
    id: cell.column.id,
    disabled: isNonDraggable
  });
  const style: CSSProperties = {
    opacity: isDragging ? 0.8 : 1,
    position: "relative",
    transform: CSS.Translate.toString(transform),
    transition,
    width: cell.column.getSize(),
    zIndex: isDragging ? 1 : 0
  };
  if (isNonDraggable) {
    return (
      <TableCell
        className={isSelectColumn ? "w-[50px]" : ""}
        style={{ width: cell.column.getSize() }}>
        <div className={isSelectColumn ? "flex items-center" : ""}>
          {flexRender(cell.column.columnDef.cell, cell.getContext())}
        </div>
      </TableCell>
    );
  }
  return (
    <TableCell ref={setNodeRef} className="truncate" style={style}>
      {flexRender(cell.column.columnDef.cell, cell.getContext())}
    </TableCell>
  );
}
