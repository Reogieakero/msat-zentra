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
import {
  KanbanBoardSkeleton,
} from "@/components/shared/zentra-skeletons/ZentraSkeletons";
import page from "./ClassWorkspace.module.css";
import skel from "./class-workspace-skeleton.module.css";

const TABLE_ROWS = 8;

function EncodeCardSkeleton() {
  return (
    <KanbanBoardSkeleton rows={0} titleWidth="9rem" showCount>
      <div className="flex items-center justify-between gap-2 px-1" aria-hidden="true">
        <span className="flex flex-wrap items-center gap-1">
          <Skeleton className="h-5 w-16 rounded-md" />
          <Skeleton className="h-5 w-20 rounded-md" />
          <Skeleton className="h-5 w-24 rounded-md" />
        </span>
        <Skeleton className="h-8 w-36 shrink-0 rounded-[16px]" />
      </div>
      <Table aria-label="Loading scores">
        <TableHeader>
          <TableRow>
            <TableHead><Skeleton className={skel.headCell} style={{ width: "4rem" }} /></TableHead>
            <TableHead><Skeleton className={skel.headCell} style={{ width: "2.5rem" }} /></TableHead>
            <TableHead><Skeleton className={skel.headCell} style={{ width: "3.5rem" }} /></TableHead>
            <TableHead><Skeleton className={skel.headCell} style={{ width: "1.5rem" }} /></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: TABLE_ROWS }).map((_, i) => (
            <TableRow key={i}>
              <TableCell><Skeleton className={skel.cellName} /></TableCell>
              <TableCell><Skeleton className={skel.cellLrn} /></TableCell>
              <TableCell><Skeleton className={skel.cellScore} /></TableCell>
              <TableCell><Skeleton className={skel.cellPct} /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </KanbanBoardSkeleton>
  );
}

export function ClassWorkspaceSkeleton() {
  return (
    <section className={page.page} aria-busy="true" aria-label="Loading class workspace">
      {/* Two panels mirror the real workspace: subject list left, grades right. */}
      <div className={page.layout} aria-hidden="true">
        <aside className={page.subjectsPanel}>
          <div className={page.subjects}>
            <Skeleton className="h-8 w-full rounded-[16px]" />
            <Skeleton className="h-3 w-20" />
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-[54px] w-full rounded-lg" />
            ))}
          </div>
        </aside>
        <div className={page.main}>
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-6 w-24 rounded-[6px]" />
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Skeleton className="h-6 w-16 rounded-full" />
            <Skeleton className="h-6 w-14 rounded-full" />
          </div>
          <EncodeCardSkeleton />
        </div>
      </div>
    </section>
  );
}
