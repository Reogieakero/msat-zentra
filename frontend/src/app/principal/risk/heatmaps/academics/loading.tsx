"use client";

import { KpiStrip } from "./components/KpiStrip";
import { SubjectTrendChart } from "./components/SubjectTrendChart";
import { NeedsAttentionList } from "./components/NeedsAttentionList";
import shell from "../components/heatmap.module.css";

const noop = () => {};

/**
 * Route-level skeleton. It renders the page's own pending states so the
 * placeholder is byte-for-byte the same shape as the loaded layout: three KPI
 * boards, the Subject Trends board (chart + hint row + insight callout) and the
 * Needs Attention section head + card grid.
 */
export default function PrincipalAcademicsHeatmapLoading() {
  return (
    <div className={shell.shell}>
      <div className={shell.layout}>
        <section
          className={shell.page}
          aria-label="Loading academic heatmap"
          aria-busy="true"
        >
          <KpiStrip
            below={0}
            gradedTotal={0}
            riskySections={0}
            sectionCount={0}
            ungraded={0}
            ungradedStudents={[]}
            sharedTotal={0}
            isPending
          />
          <SubjectTrendChart
            sections={[]}
            subjects={[]}
            grades={[]}
            gradeFilter="Grade 7"
            onGradeFilterChange={noop}
            isPending
            selectedSubject={null}
            onSelectSubject={noop}
          />
          <NeedsAttentionList items={[]} isPending />
        </section>
      </div>
    </div>
  );
}
