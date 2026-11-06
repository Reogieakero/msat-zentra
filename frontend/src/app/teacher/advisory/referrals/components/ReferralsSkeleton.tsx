"use client";

import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import listStyles from "../../list/components/advisory-list.module.css";
import refStyles from "./referrals.module.css";

const ROWS = 8;
/** Column widths mirror the real table (Student, Type, Desk, Status, Referred, Actions). */
const WIDTHS = [230, 120, 160, 130, 130, 240];

function ReferralRowSkeleton() {
  return (
    <TableRow>
      <TableCell style={{ width: WIDTHS[0] }} className="py-3">
        <div className="flex items-center gap-2">
          <Skeleton className="size-7 shrink-0 rounded-full" />
          <div className="flex min-w-0 flex-col gap-1">
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-4 w-24 rounded-md" />
          </div>
        </div>
      </TableCell>
      <TableCell style={{ width: WIDTHS[1] }}>
        <Skeleton className="h-5 w-16 rounded-full" />
      </TableCell>
      <TableCell style={{ width: WIDTHS[2] }}>
        <Skeleton className="h-5 w-24 rounded-full" />
      </TableCell>
      <TableCell style={{ width: WIDTHS[3] }}>
        <Skeleton className="h-5 w-20 rounded-full" />
      </TableCell>
      <TableCell style={{ width: WIDTHS[4] }}>
        <Skeleton className="h-3.5 w-20" />
      </TableCell>
      <TableCell style={{ width: WIDTHS[5] }}>
        <div className="flex items-center justify-end gap-1.5">
          <Skeleton className="h-6 w-16 rounded-md" />
          <Skeleton className="h-6 w-16 rounded-md" />
          <Skeleton className="h-6 w-6 shrink-0 rounded-md" />
        </div>
      </TableCell>
    </TableRow>
  );
}

/**
 * Referrals loading state — mirrors the loaded desk: "Referrals" header with
 * the filter field, the six-column referral table (mascot + name + LRN pill,
 * type/desk/status pills, referred date, action buttons), its pagination, the
 * icon rail, and the starter strip on small screens.
 */
export function ReferralsSkeleton() {
  return (
    <div className="flex min-w-0 flex-col gap-4" aria-busy="true" aria-label="Loading referrals">
      <div className="grid flex-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_2.75rem]">
        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="mt-1.5 h-3.5 w-40" />
            </div>
            <Skeleton className="h-9 w-40 shrink-0 rounded-[16px]" />
          </div>

          <div className={`${listStyles.tableWrap} ${refStyles.flatTable}`}>
            <Table className="w-full table-fixed">
              <TableHeader>
                <TableRow className="bg-muted/50 [&>th]:border-t-0">
                  {WIDTHS.map((width, i) => (
                    <TableHead key={i} style={{ width }} className="h-10">
                      <Skeleton className="h-3 w-16" />
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: ROWS }).map((_, i) => (
                  <ReferralRowSkeleton key={i} />
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-3 w-20" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-8 w-8 rounded-md" />
              <Skeleton className="h-8 w-8 rounded-md" />
              <Skeleton className="h-8 w-8 rounded-md" />
            </div>
          </div>
        </div>

        <div
          className="hidden min-w-0 flex-col items-end gap-2 self-start lg:sticky lg:top-16 lg:flex"
          aria-hidden
        >
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-9 rounded-xl" />
          ))}
        </div>
      </div>

      <div className="border-t border-border pt-4 lg:hidden" aria-hidden>
        <div className={refStyles.stripGrid}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="flex min-w-0 flex-col gap-2 rounded-xl border border-border p-2.5"
            >
              <div className="flex items-center gap-1.5 border-b border-border pb-2">
                <Skeleton className="size-3.5 shrink-0 rounded-sm" />
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="ml-auto h-6 w-16 rounded-md" />
              </div>
              <Skeleton className="h-20 w-full rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
