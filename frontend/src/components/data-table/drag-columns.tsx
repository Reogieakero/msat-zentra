"use client";

import type { CSSProperties } from "react";
import { ArrowUpDown, GripVertical } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { flexRender, type Cell, type Header } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { TableCell, TableHead } from "@/components/ui/table";

/* Shared draggable/sortable header + cell (data-table5 pattern). Header
   labels align with cell content — grip/sort controls sit after the text. */
export function DraggableHeader<TData>({ header }: { header: Header<TData, unknown> }) {
  const isSelectColumn = header.column.id === "select";
  const isActionsColumn = header.column.id === "actions";
  const isNonDraggable = isSelectColumn || isActionsColumn;
  const { attributes, isDragging, listeners, setNodeRef, transform, transition } = useSortable({
    id: header.column.id,
    disabled: isNonDraggable,
  });

  const style: CSSProperties = {
    opacity: isDragging ? 0.8 : 1,
    position: "relative",
    transform: CSS.Translate.toString(transform),
    transition,
    whiteSpace: "nowrap",
    width: header.column.getSize(),
    zIndex: isDragging ? 1 : 0,
  };

  if (isNonDraggable) {
    return (
      <TableHead
        className="relative h-10 border-t"
        style={{ width: header.column.getSize() }}
        colSpan={header.colSpan}
      >
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
      colSpan={header.colSpan}
    >
      <div className="flex items-center justify-start gap-0.5">
        <span className="min-w-0 shrink truncate">
          {header.isPlaceholder
            ? null
            : flexRender(header.column.columnDef.header, header.getContext())}
        </span>
        {header.column.getCanSort() && (
          <Button
            size="icon"
            variant="ghost"
            className="group h-7 w-7 shrink-0"
            onClick={header.column.getToggleSortingHandler()}
            aria-label="Toggle sorting"
          >
            <ArrowUpDown className="h-4 w-4 shrink-0 opacity-60" aria-hidden="true" />
          </Button>
        )}
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 shrink-0"
          {...attributes}
          {...listeners}
          aria-label="Drag to reorder"
        >
          <GripVertical className="h-3 w-3 opacity-60" aria-hidden="true" />
        </Button>
      </div>
    </TableHead>
  );
}

export function DragAlongCell<TData>({ cell }: { cell: Cell<TData, unknown> }) {
  const isSelectColumn = cell.column.id === "select";
  const isActionsColumn = cell.column.id === "actions";
  const isNonDraggable = isSelectColumn || isActionsColumn;
  const { isDragging, setNodeRef, transform, transition } = useSortable({
    id: cell.column.id,
    disabled: isNonDraggable,
  });

  const style: CSSProperties = {
    opacity: isDragging ? 0.8 : 1,
    position: "relative",
    transform: CSS.Translate.toString(transform),
    transition,
    width: cell.column.getSize(),
    zIndex: isDragging ? 1 : 0,
  };

  if (isNonDraggable) {
    return (
      <TableCell
        className={isSelectColumn ? "w-[50px]" : ""}
        style={{ width: cell.column.getSize() }}
      >
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
