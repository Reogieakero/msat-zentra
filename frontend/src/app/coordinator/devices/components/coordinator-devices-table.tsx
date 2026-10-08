"use client";

import * as React from "react";
import { ChevronDown, Loader2, SearchIcon, TabletSmartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  InputGroup,
  InputGroupInput,
  InputGroupAddon,
} from "@/components/ui/input-group";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
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
import { DeviceDetailsModal } from "./coordinator-device-details-modal";
import type { AdmDeviceRow } from "@/services/coordinator/coordinator.types";
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";
import styles from "./coordinator-devices-table.module.css";

export type DeviceFilter = "all" | "issued" | "returned";

const STATUS_OPTIONS: { value: DeviceFilter; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "issued", label: "Issued" },
  { value: "returned", label: "Returned" },
];

interface CoordinatorDevicesTableProps {
  rows: AdmDeviceRow[];
  isPending: boolean;
  isError: boolean;
  isRefetching: boolean;
  query: string;
  onQueryChange: (v: string) => void;
  filter: DeviceFilter;
  statusLabel: string;
  onFilterChange: (v: DeviceFilter) => void;
  hasActiveFilters: boolean;
  onClear: () => void;
  returningId?: string | null;
  total: number;
  start: number;
  end: number;
  page: number;
  totalPages: number;

  isBackground?: boolean;
  onRetry: () => void;
  onPageChange: (page: number) => void;
  onRecordReturn: (row: AdmDeviceRow) => void;
}

export function CoordinatorDevicesTable({
  rows,
  isPending,
  isError,
  isRefetching,
  query,
  onQueryChange,
  filter,
  statusLabel,
  onFilterChange,
  hasActiveFilters,
  onClear,
  returningId = null,
  total,
  start,
  end,
  page,
  totalPages,
  isBackground = false,
  onRetry,
  onPageChange,
  onRecordReturn,
}: CoordinatorDevicesTableProps) {
  const [detailsRow, setDetailsRow] = React.useState<AdmDeviceRow | null>(null);

  if (isPending) {
    return (
      <div className={`${assign.card} ${styles.steady}`} aria-busy="true" aria-label="Loading devices">
        <span className={assign.glowClip} aria-hidden="true">
          <span className={assign.cardGlow} />
        </span>
        <div className="relative flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <Skeleton className={styles.skelTitle} />
            <Skeleton className={styles.skelDesc} />
          </div>
          <Skeleton className={styles.skelSearch} />
        </div>
        <div className="relative overflow-x-auto rounded-md border">
          <table className={styles.skelTable} aria-hidden="true">
            <tbody>
              {Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}>
                  <td>
                    <Skeleton className={styles.skelRow} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className={`${assign.card} ${styles.steady}`} role="alert">
        <span className={assign.glowClip} aria-hidden="true">
          <span className={assign.cardGlow} />
        </span>
        <div className="relative flex flex-col items-start gap-2">
          <p className={styles.sectionTitle}>Learning Devices</p>
          <p className={styles.sectionDesc}>
            We couldn&apos;t load the device ledger. Please check your internet
            connection and try again.
          </p>
          <Button
            size="sm"
            variant="outline"
            disabled={isRefetching}
            onClick={onRetry}
          >
            {isRefetching ? "Loading…" : "Try again"}
          </Button>
        </div>
      </div>
    );
  }

  if (rows.length === 0 && !hasActiveFilters) {
    return (
      <div className={`${assign.card} ${styles.steady}`}>
        <span className={assign.glowClip} aria-hidden="true">
          <span className={assign.cardGlow} />
        </span>
        <div className="relative">
          <h2 className={styles.sectionTitle}>Learning Devices</h2>
          <p className={styles.sectionDesc}>
            Track every learning device issued to ADM learners.
          </p>
        </div>
        <div className="relative flex flex-col items-center gap-2 py-6 text-center">
          <span
            className="flex h-12 w-12 items-center justify-center rounded-full bg-muted"
            aria-hidden="true"
          >
            <TabletSmartphone size={24} className="text-muted-foreground" />
          </span>
          <p className="font-medium">No devices issued yet</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Devices issued to approved learners will appear here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`${assign.card} ${styles.steady}`}>
      <span className={assign.glowClip} aria-hidden="true">
        <span className={assign.cardGlow} />
      </span>
      <div className="relative flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className={styles.sectionTitle}>Learning Devices</h2>
          <p className={styles.sectionDesc}>
            Track every learning device issued to ADM learners
            {isBackground ? " · Syncing…" : "."}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <InputGroup className="max-w-40 shrink-0">
            <InputGroupInput
              placeholder="Search devices..."
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              aria-label="Search serial, student, or LRN"
            />
            <InputGroupAddon>
              <SearchIcon />
            </InputGroupAddon>
          </InputGroup>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                {filter === "all" ? "Status" : statusLabel}
                <ChevronDown aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {STATUS_OPTIONS.map((item) => (
                <DropdownMenuCheckboxItem
                  key={item.value}
                  checked={filter === item.value}
                  onCheckedChange={() => onFilterChange(item.value)}
                >
                  {item.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={onClear}>
              Clear
            </Button>
          )}
        </div>
      </div>
      <div className="relative overflow-x-auto rounded-md border">
        <Table className="w-full table-fixed">
          <TableHeader>
            <TableRow className="bg-muted/50 [&>th]:border-t-0">
              <TableHead style={{ width: 220 }}>Device</TableHead>
              <TableHead style={{ width: 220 }}>Student</TableHead>
              <TableHead style={{ width: 100 }}>Grade</TableHead>
              <TableHead style={{ width: 170 }}>Issued</TableHead>
              <TableHead style={{ width: 120 }}>Returned</TableHead>
              <TableHead style={{ width: 110 }}>Status</TableHead>
              <TableHead style={{ width: 190 }}>
                <span className="sr-only">Row actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length ? (
              rows.map((d) => (
                <TableRow key={d.id}>
                <TableCell className="truncate">
                  <p
                    className={styles.cellMain}
                    title={
                      d.conditionNotes
                        ? `${d.deviceType} · ${d.deviceSerial} — ${d.conditionNotes}`
                        : `${d.deviceType} · ${d.deviceSerial}`
                    }
                  >
                    {d.deviceType} · {d.deviceSerial}
                  </p>
                </TableCell>
                  <TableCell className="truncate">
                    <div className="min-w-0">
                      <p
                        className={styles.cellMain}
                        title={`${d.student} · ${d.lrn}`}
                      >
                        {d.student}
                      </p>
                      <p className={`${styles.cellSub} ${styles.mono}`}>
                        {d.lrn}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell className="truncate">
                    <p className={styles.cellMain}>{d.grade || "—"}</p>
                  </TableCell>
                  <TableCell className="truncate">
                    <div className="min-w-0">
                      <p className={styles.cellMain}>{d.issuedDate}</p>
                      <p
                        className={styles.cellSub}
                        title={`Issued by ${d.issuedBy}`}
                      >
                        {d.issuedBy}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell className="truncate">
                    <p className={styles.cellMain}>{d.returnedDate ?? "—"}</p>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={d.status === "issued" ? "secondary" : "outline"}
                    >
                      {d.status === "issued" ? "Issued" : "Returned"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setDetailsRow(d)}
                        aria-label={`View details of ${d.deviceSerial}`}
                      >
                        Details
                      </Button>
                      {d.status === "issued" ? (
                        <Button
                          size="sm"
                          disabled={returningId === d.id}
                          onClick={() => onRecordReturn(d)}
                          aria-label={`Record return of ${d.deviceSerial}`}
                        >
                          {returningId === d.id ? (
                            <>
                              <Loader2
                                className={styles.spin}
                                aria-hidden="true"
                              />
                              Recording…
                            </>
                          ) : (
                            "Record return"
                          )}
                        </Button>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center">
                  No devices match the current filters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="relative flex items-center justify-end space-x-2">
        <div className="text-muted-foreground flex-1 text-sm">
          Showing {start}–{end} of {total}
        </div>
        <div className="space-x-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => onPageChange(Math.max(1, page - 1))}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
          >
            Next
          </Button>
        </div>
      </div>
      <DeviceDetailsModal row={detailsRow} onClose={() => setDetailsRow(null)} />
    </div>
  );
}
