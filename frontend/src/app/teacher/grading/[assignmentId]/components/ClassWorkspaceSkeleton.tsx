"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import page from "./ClassWorkspace.module.css";
import side from "./WorkspaceSidebar.module.css";
import grid from "./ScoreGrid.module.css";
import skel from "./class-workspace-skeleton.module.css";

const WEIGHT_ROWS = 3;
const RECENT_ROWS = 3;
const TABLE_ROWS = 8;

/* Sidebar placeholders — same weights card, recent-assessments card, and
   finals banner structure as WorkspaceSidebar. */
function SidebarSkeleton() {
  return (
    <aside className={side.sidebar} aria-hidden="true">
      <div className={side.card}>
        <Skeleton className={skel.cardTitle} />
        <ul className={side.weightList}>
          {Array.from({ length: WEIGHT_ROWS }).map((_, i) => (
            <li key={i} className={side.weightRow}>
              <Skeleton className={skel.dot} />
              <Skeleton className={skel.weightName} />
              <Skeleton className={skel.weightValue} />
            </li>
          ))}
        </ul>
        <div className={side.actions}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className={skel.actionBtn} />
          ))}
        </div>
      </div>

      <div className={side.card}>
        <div className={side.recentHead}>
          <Skeleton className={skel.cardTitle} />
          <Skeleton className={skel.viewAllBtn} />
        </div>
        <ul className={side.recentList}>
          {Array.from({ length: RECENT_ROWS }).map((_, i) => (
            <li key={i} className={side.weightRow}>
              <Skeleton className={skel.dot} />
              <div className={side.recentText}>
                <Skeleton className={skel.recentTitle} />
                <Skeleton className={skel.recentMeta} />
              </div>
              <div className={side.recentMax}>
                <Skeleton className={skel.recentMaxValue} />
                <Skeleton className={skel.recentMaxLabel} />
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className={side.bannerCard}>
        <div className={side.bannerTop}>
          <Skeleton className={skel.bannerTitle} />
          <Skeleton className={skel.bannerCount} />
        </div>
        <Skeleton className={skel.bannerSub} />
        <Skeleton className={skel.bannerAction} />
      </div>
    </aside>
  );
}

/* Encode-scores placeholder — same Card shell and fixed-layout
   Student / LRN / Score / % table (38/24/22/16) as ScoreGrid, with an
   input-sized slot in the score column. */
function EncodeCardSkeleton() {
  return (
    <Card className={grid.card} aria-hidden="true">
      <CardHeader className={grid.header}>
        <div className={grid.headerText}>
          <Skeleton className={skel.eyebrow} />
          <Skeleton className={skel.metaLine} />
          <Skeleton className={skel.sectionSub} />
        </div>
        <Skeleton className={skel.editBtn} />
      </CardHeader>
      <CardContent className={grid.content}>
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
      </CardContent>
      <CardFooter className={grid.footer}>
        <Skeleton className={skel.footRange} />
        <Skeleton className={skel.footHint} />
      </CardFooter>
    </Card>
  );
}

/* Full workspace placeholder mirroring the loaded class workspace:
   back link + header, sidebar rail, and encode-scores card. */
export function ClassWorkspaceSkeleton() {
  return (
    <section className={page.page} aria-busy="true" aria-label="Loading class workspace">
      <div className={page.topRow} aria-hidden="true">
        <Skeleton className={page.skelBack} />
        <div className={page.skelHead}>
          <Skeleton className={skel.headTitle} />
          <Skeleton className={skel.headSub} />
        </div>
      </div>
      <div className={page.layout} aria-hidden="true">
        <SidebarSkeleton />
        <div className={page.main}>
          <EncodeCardSkeleton />
        </div>
      </div>
    </section>
  );
}
