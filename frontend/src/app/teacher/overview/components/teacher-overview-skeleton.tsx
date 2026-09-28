"use client";

import { Skeleton } from "@/components/ui/skeleton";
import {
  TeacherOverviewActions,
  type QuickAction,
} from "./teacher-overview-actions";
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";
import layout from "./teacher-overview.module.css";
import header from "./teacher-overview-header.module.css";
import skel from "./teacher-overview-skeleton.module.css";

/* Profile card placeholder — same section-card shell (glow, avatar,
   title, 2-stat row) as TeacherOverviewHeader's profile. */
function ProfileSkeleton() {
  return (
    <article
      className={assign.card}
      aria-hidden="true"
    >
      <span className={assign.glowClip} aria-hidden="true">
        <span className={assign.cardGlow} />
      </span>
      <div className="relative flex flex-col gap-1">
        <div className={assign.cardHead}>
          <Skeleton className={skel.skelAvatar} />
          <div className="flex flex-1 flex-col gap-1">
            <Skeleton className={skel.skelHeroTitle} />
            <Skeleton className={skel.skelAdvisory} />
          </div>
        </div>
      </div>
      <div className={`${header.profileFoot} relative`}>
        {[0, 1].map((i) => (
          <div key={i} className={header.stat}>
            <Skeleton className={skel.skelStatIcon} />
            <div className={header.statText}>
              <Skeleton className={skel.skelStatValue} />
              <Skeleton className={skel.skelStatLabel} />
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}

/* At-risk card placeholder — reserves the 140x140 radial and the 3-row
   legend the real chart card renders. */
function RiskChartSkeleton() {
  return (
    <div
      className={assign.card}
      aria-hidden="true"
    >
      <span className={assign.glowClip} aria-hidden="true">
        <span className={assign.cardGlow} />
      </span>
      <div className="relative flex items-center gap-3">
        <Skeleton className={skel.skelAvatar} />
        <div className="flex flex-1 flex-col gap-1">
          <Skeleton className={skel.skelSectionTitle} />
          <Skeleton className={skel.skelSectionMeta} />
        </div>
      </div>
      <div className="relative">
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
      </div>
    </div>
  );
}

interface TeacherOverviewSkeletonProps {
  actions: QuickAction[];
}

/* Full-page placeholder mirroring the loaded overview: class grid cards
   on the left; profile, up-next, risk chart, and the REAL static quick
   actions (which need no data) in the right rail. */
export function TeacherOverviewSkeleton({ actions }: TeacherOverviewSkeletonProps) {
  return (
    <section
      className={layout.page}
      aria-busy="true"
      aria-label="Loading overview"
    >
      <div className={layout.body}>
        <div className={layout.mainCol}>
          <TeacherOverviewActions actions={actions} row />
          <div className="rounded-xl border border-input bg-card p-5" aria-hidden="true">
            <div className="h-5 w-48 rounded bg-muted" />
            <div className="mt-4 flex flex-col gap-2">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="h-10 rounded-md bg-muted" />
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-2" aria-hidden="true">
            <div className="h-5 w-40 rounded bg-muted" />
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-12 rounded-md bg-muted" />
            ))}
          </div>
          <div className="rounded-xl border border-input bg-card p-5" aria-hidden="true">
            <div className="h-5 w-56 rounded bg-muted" />
            <div className="mt-4 flex flex-col gap-2">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-10 rounded-md bg-muted" />
              ))}
            </div>
          </div>
        </div>
        <aside className={layout.sideCol}>
          <ProfileSkeleton />
          <aside
            className={header.populationPanel}
            aria-hidden="true"
          >
            <section className={header.chartColumn}>
              <header className={header.sectionHead}>
                <Skeleton className={skel.skelSectionTitle} />
              </header>
              <div className="flex flex-col gap-2">
                {[0, 1].map((i) => (
                  <Skeleton key={i} className={skel.skelName} />
                ))}
              </div>
            </section>
          </aside>
          <RiskChartSkeleton />
        </aside>
      </div>
    </section>
  );
}
