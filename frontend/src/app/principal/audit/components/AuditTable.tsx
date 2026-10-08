import * as React from "react";
import {
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  flexRender,
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
} from "@tanstack/react-table";
import { ChevronRight } from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  ACTION_LABELS,
  ROLE_LABELS,
  type AuditEntry,
} from "@/services/principal/audit.types";
import { buildChangeLines, summarizeAction } from "../format-change";
import styles from "./audit-table.module.css";

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function DiffCard({
  title,
  lines,
}: {
  title: string;
  lines: { label: string; value: string }[];
}) {
  return (
    <div className={styles.diffCol}>
      <span className={styles.diffLabel}>{title}</span>
      {lines.length === 0 ? (
        <p className={styles.diffEmpty}>No values recorded.</p>
      ) : (
        <dl className={styles.diffFields}>
          {lines.map((line) => (
            <div className={styles.diffField} key={line.label}>
              <dt className={styles.diffFieldLabel}>{line.label}</dt>
              <dd className={styles.diffFieldValue}>{line.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

function FriendlyDiff({ entry }: { entry: AuditEntry }) {
  const lines = buildChangeLines(entry);
  const fromLines = lines.map((l) => ({ label: l.label, value: l.from }));
  const toLines = lines.map((l) => ({ label: l.label, value: l.to }));
  return (
    <div className={styles.diff}>
      <p className={styles.diffSummary}>{summarizeAction(entry)}</p>
      <div className={styles.diffCards}>
        <DiffCard title="Before" lines={fromLines} />
        <div className={styles.diffArrow} aria-hidden>
          →
        </div>
        <DiffCard title="After" lines={toLines} />
      </div>
    </div>
  );
}

export function AuditTable({ entries }: { entries: AuditEntry[] }) {
  const [expandedId, setExpandedId] = React.useState<string | null>(null);
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);

  const columns = React.useMemo<ColumnDef<AuditEntry>[]>(
    () => [
      {
        id: "expander",
        header: "",
        size: 36,
        minSize: 36,
        maxSize: 36,
        enableSorting: false,
        cell: ({ row }) => {
          const expanded = expandedId === row.original.id;
          return (
            <ChevronRight
              className={`${styles.chevron} ${expanded ? styles.chevronOpen : ""}`}
              aria-hidden
            />
          );
        },
      },
      {
        id: "timestamp",
        accessorFn: (row) => row.timestamp,
        header: "Timestamp",
        size: 170,
        minSize: 170,
        maxSize: 170,
        cell: ({ row }) => (
          <span className={styles.mono}>{formatTimestamp(row.original.timestamp)}</span>
        ),
      },
      {
        id: "actor",
        accessorFn: (row) => row.user,
        header: "Actor",
        size: 180,
        minSize: 180,
        maxSize: 180,
      },
      {
        id: "role",
        accessorFn: (row) => row.actorRole,
        header: "Role",
        size: 120,
        minSize: 120,
        maxSize: 120,
        cell: ({ row }) => (
          <Badge variant="outline" className={styles.roleBadge}>
            {ROLE_LABELS[row.original.actorRole]}
          </Badge>
        ),
      },
      {
        id: "action",
        accessorFn: (row) => row.actionType,
        header: "Action",
        size: 150,
        minSize: 150,
        maxSize: 150,
        cell: ({ row }) => <span>{ACTION_LABELS[row.original.actionType]}</span>,
      },
      {
        id: "source",
        accessorFn: (row) => row.sourceLabel,
        header: "Source",
        size: 170,
        minSize: 170,
        maxSize: 170,
      },
      {
        id: "reason",
        accessorFn: (row) => row.reason,
        header: "Reason",
        size: 220,
        minSize: 220,
        maxSize: 220,
        cell: ({ row }) => (
          <span className={styles.reasonText} title={row.original.reason}>
            {row.original.reason}
          </span>
        ),
      },
    ],
    [expandedId]
  );

  const table = useReactTable({
    data: entries,
    columns,
    getRowId: (row) => row.id,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    state: { sorting, columnFilters },
  });

  return (
    <div className="relative overflow-x-auto rounded-md border">
      <Table className="w-full table-fixed" aria-label="Audit entries">
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
              const entry = row.original;
              const expanded = expandedId === entry.id;
              return (
                <React.Fragment key={row.id}>
                  <TableRow
                    aria-expanded={expanded}
                    onClick={() => setExpandedId(expanded ? null : entry.id)}
                    style={{ cursor: "pointer" }}
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
                  {expanded ? (
                    <TableRow
                      className={styles.detailRow}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <TableCell />
                      <TableCell colSpan={columns.length - 1}>
                        <div className={styles.detail}>
                          <FriendlyDiff entry={entry} />
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : null}
                </React.Fragment>
              );
            })
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center">
                No audit entries match your search.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
