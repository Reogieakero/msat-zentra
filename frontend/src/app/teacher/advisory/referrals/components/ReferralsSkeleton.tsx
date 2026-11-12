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
      <TableCell style={{ width: WIDTHS[0] }}>
        <div className="flex min-w-0 items-center gap-2">
          <Skeleton className="size-7 shrink-0 rounded-full" />
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-5 w-24 rounded-md" />
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
          <span aria-hidden className="mx-0.5 h-4 w-px shrink-0 bg-border" />
          <Skeleton className="h-6 w-6 shrink-0 rounded-md" />
        </div>
      </TableCell>
    </TableRow>
  );
}

/**
 * Referrals loading state — mirrors the loaded desk row for row: the top gutter
 * (filter field on the left, the four 24px page action buttons on the right),
 * the six-column referral table (mascot + name + LRN pill, type/desk/status
 * pills, referred date, action buttons) and its pagination.
 */
export function ReferralsSkeleton() {
  return (
    <div className="flex min-w-0 flex-col gap-4" aria-busy="true" aria-label="Loading referrals">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Skeleton className="h-9 w-40 shrink-0 rounded-[16px]" />
        <div className="flex min-w-0 flex-wrap items-center justify-end gap-1.5">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-6 w-28 rounded-md" />
          ))}
        </div>
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
          <Skeleton className="size-8 rounded-md" />
          <Skeleton className="size-8 rounded-md" />
        </div>
      </div>
    </div>
  );
}
