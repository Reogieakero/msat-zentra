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
import {
  TeacherOverviewActions,
  type QuickAction,
} from "./teacher-overview-actions";
import layout from "./teacher-overview.module.css";
import header from "./teacher-overview-header.module.css";
import advisory from "./teacher-overview-advisory.module.css";
import skel from "./teacher-overview-skeleton.module.css";

/* Profile card placeholder — same shell classes as TeacherOverviewHeader's
   rail profile so padding, avatar size, and the 3-stat grid all match. */
function ProfileSkeleton() {
  return (
    <article
      className={`${header.profile} ${header.rail}`}
      aria-hidden="true"
    >
      <div className={header.profileBody}>
        <div className={header.identityBlock}>
          <Skeleton className={skel.skelAvatar} />
          <div className={header.identity} style={{ flex: 1 }}>
            <Skeleton className={skel.skelHeroTitle} />
            <Skeleton className={skel.skelAdvisory} />
          </div>
        </div>
        <div className={header.profileFoot}>
          {[0, 1, 2].map((i) => (
            <div key={i} className={header.stat}>
              <Skeleton className={skel.skelStatIcon} />
              <div className={header.statText}>
                <Skeleton className={skel.skelStatValue} />
                <Skeleton className={skel.skelStatLabel} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </article>
  );
}

/* At-risk card placeholder — reserves the 140x140 radial, the 3-row legend,
   and the flip-button footer the real chart card renders. */
function RiskChartSkeleton() {
  return (
    <aside
      className={`${header.populationPanel} ${header.railPanel}`}
      aria-hidden="true"
    >
      <section className={header.chartColumn}>
        <header className={header.sectionHead}>
          <Skeleton className={skel.skelSectionTitle} />
          <Skeleton className={skel.skelSectionMeta} />
        </header>
        <div className={header.riskBlock}>
          <div className={header.riskChart}>
            <Skeleton className={skel.skelRiskCircle} />
          </div>
          <ul className={header.riskLegend}>
            {[0, 1, 2].map((i) => (
              <li key={i} className={header.riskLegendItem}>
                <Skeleton className={skel.skelLegendDot} />
                <div className={header.riskLegendBody}>
                  <Skeleton className={skel.skelLegendTop} />
                  <Skeleton className={skel.skelLegendCount} />
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div className={header.flipFoot}>
          <Skeleton className={skel.skelFlipBtn} />
        </div>
      </section>
    </aside>
  );
}

const SKELETON_ROWS = 10;

/* Advisory-students placeholder — same Card shell, header controls, 10-row
   4-column table, and pager footer as TeacherOverviewAdvisory. */
function AdvisoryTableSkeleton() {
  return (
    <Card className={advisory.card} aria-hidden="true">
      <CardHeader className={advisory.header}>
        <div className={advisory.headerText}>
          <Skeleton className={skel.skelAdvisoryTitle} />
          <Skeleton className={skel.skelAdvisoryDesc} />
        </div>
        <div className={advisory.headerActions}>
          <Skeleton className={skel.skelSearch} />
          <Skeleton className={skel.skelFilterBtn} />
        </div>
      </CardHeader>
      <CardContent className={advisory.content}>
        <Table aria-label="Loading advisory students">
          <TableHeader>
            <TableRow>
              <TableHead>
                <Skeleton
                  className={skel.skelHeadCell}
                  style={{ width: "4rem" }}
                />
              </TableHead>
              <TableHead>
                <Skeleton
                  className={skel.skelHeadCell}
                  style={{ width: "3rem" }}
                />
              </TableHead>
              <TableHead>
                <Skeleton
                  className={skel.skelHeadCell}
                  style={{ width: "2.5rem" }}
                />
              </TableHead>
              <TableHead>
                <span className={advisory.srOnly}>Row actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
              <TableRow key={i}>
                <TableCell>
                  <Skeleton className={skel.skelName} />
                  <Skeleton className={skel.skelSection} />
                </TableCell>
                <TableCell>
                  <Skeleton className={skel.skelBadge} />
                </TableCell>
                <TableCell>
                  <Skeleton className={skel.skelFlag} />
                </TableCell>
                <TableCell>
                  <Skeleton className={skel.skelRowAction} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
      <CardFooter className={advisory.footer}>
        <Skeleton className={skel.skelRange} />
        <div className={advisory.pagerButtons}>
          <Skeleton className={skel.skelPagerBtn} />
          <Skeleton className={skel.skelPageLabel} />
          <Skeleton className={skel.skelPagerBtn} />
        </div>
      </CardFooter>
    </Card>
  );
}

interface TeacherOverviewSkeletonProps {
  actions: QuickAction[];
}

/* Full-page placeholder mirroring the loaded overview: rail (profile +
   risk chart + the REAL static quick actions, which need no data) beside
   the advisory-students card. */
export function TeacherOverviewSkeleton({ actions }: TeacherOverviewSkeletonProps) {
  return (
    <section
      className={layout.page}
      aria-busy="true"
      aria-label="Loading overview"
    >
      <div className={layout.body}>
        <aside className={layout.sideCol}>
          <ProfileSkeleton />
          <RiskChartSkeleton />
          <TeacherOverviewActions actions={actions} compact />
        </aside>
        <div className={layout.mainCol}>
          <AdvisoryTableSkeleton />
        </div>
      </div>
    </section>
  );
}
