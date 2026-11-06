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
  IconRailSkeleton,
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
      {/* Toolbar row mirrors the real SubjectRail switcher + assessment search. */}
      <div className="flex flex-wrap items-center justify-between gap-3" aria-hidden="true">
        <div className="flex min-w-0 flex-1 flex-row gap-2 overflow-x-auto pb-0.5">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-[54px] w-40 shrink-0 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-8 w-40 shrink-0 rounded-[16px]" />
      </div>
      {/* Real grid is [main 1fr | gutter 2.75rem]; the main column comes first. */}
      <div className={page.layout} aria-hidden="true">
        <div className={page.main}>
          <EncodeCardSkeleton />
        </div>
        <IconRailSkeleton count={4} />
      </div>
    </section>
  );
}
