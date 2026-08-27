import * as React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, Flame, BookOpen } from "lucide-react";
import { type AcademicHeatmapData } from "./types";
import { apiClient } from "@/lib/api/client";
import { BlobCard } from "./BlobCard";
import { useGradeMode } from "../../../grade-mode-context";
import styles from "./heatmap.module.css";

// Brand-aligned green intensity ramp (single hue = system --primary deep green).
// Higher student count below 75 = stronger green fill, matching Zentra heatmaps.
const SCALE = [
  "color-mix(in oklch, var(--primary), transparent 92%)",
  "color-mix(in oklch, var(--primary), transparent 78%)",
  "color-mix(in oklch, var(--primary), transparent 58%)",
  "color-mix(in oklch, var(--primary), transparent 32%)",
  "color-mix(in oklch, var(--primary), transparent 8%)",
];

const TEXT_BY_LEVEL = [
  "var(--muted-foreground)",
  "var(--foreground)",
  "var(--foreground)",
  "var(--primary-foreground)",
  "var(--primary-foreground)",
];

// Intensity is driven by the raw student count below 75 (not a percentage).
function levelForCount(count: number): number {
  if (count <= 0) return 0;
  if (count <= 2) return 1;
  if (count <= 4) return 2;
  if (count <= 7) return 3;
  return 4;
}

function cellColor(count: number): string {
  return SCALE[levelForCount(count)];
}

function cellText(count: number): string {
  return TEXT_BY_LEVEL[levelForCount(count)];
}

// Shape returned by GET /api/academics (see backend academics.service.ts).
type BackendAcademicSummary = {
  sections: {
    sectionId: string;
    section: string;
    grade: string;
    students: {
      subjects: { subject: string; transmutedGrade: number }[];
    }[];
  }[];
};

// Adapt the live academics summary into the heatmap matrix shape.
// - Per-cell count = distinct students BELOW 75 IN THAT SUBJECT (drill-down view).
// - Section "students below 75" + the top tile use the OVERALL-AVERAGE distinct
//   students (matching the Risk engine's academic flag in services/risk.ts), so
//   the headline numbers reconcile with the Risk board/heatmap/students.
// Status-only: no student identities, only aggregated counts.
function studentAverageBelow75(subjects: { transmutedGrade: number }[]): boolean {
  if (subjects.length === 0) return false;
  const avg =
    subjects.reduce((sum, s) => sum + (s.transmutedGrade ?? 0), 0) / subjects.length;
  return avg < 75;
}

function normalizeAcademic(raw: BackendAcademicSummary): AcademicHeatmapData {
  const subjectEnrolled = new Map<string, number>();
  const subjectBelow = new Map<string, number>();

  const sections = raw.sections.map((section) => {
    const subjectEnrolledInSection = new Map<string, number>();
    const subjectBelowInSection = new Map<string, number>();

    for (const student of section.students) {
      // Cell counts: below 75 in the specific subject.
      for (const subj of student.subjects) {
        subjectEnrolledInSection.set(
          subj.subject,
          (subjectEnrolledInSection.get(subj.subject) ?? 0) + 1
        );
        if (subj.transmutedGrade < 75) {
          subjectBelowInSection.set(
            subj.subject,
            (subjectBelowInSection.get(subj.subject) ?? 0) + 1
          );
        }
      }
    }

    const cells = Array.from(subjectEnrolledInSection.entries()).map(([subject, enrolled]) => {
      const below = subjectBelowInSection.get(subject) ?? 0;
      subjectEnrolled.set(subject, (subjectEnrolled.get(subject) ?? 0) + enrolled);
      subjectBelow.set(subject, (subjectBelow.get(subject) ?? 0) + below);
      return {
        subject,
        below75Count: below,
        below75Pct: enrolled > 0 ? Math.round((below / enrolled) * 1000) / 10 : 0,
        enrolled,
      };
    });

    // Distinct students in this section whose OVERALL average is below 75 —
    // matches the Risk engine's academic flag.
    const studentsBelow = section.students.filter((st) =>
      studentAverageBelow75(st.subjects)
    ).length;

    return {
      sectionId: section.sectionId,
      section: section.section,
      gradeLevel: section.grade,
      cells,
      anyAtRisk: cells.some((c) => c.below75Count > 0),
      studentsBelow,
    };
  });

  const subjectTotals = Array.from(subjectEnrolled.entries())
    .map(([subject, enrolled]) => {
      const below = subjectBelow.get(subject) ?? 0;
      return {
        subject,
        below75Count: below,
        below75Pct: enrolled > 0 ? Math.round((below / enrolled) * 1000) / 10 : 0,
      };
    })
    .sort((a, b) => b.below75Count - a.below75Count);

  const subjects = subjectTotals.map((t) => t.subject);

  return {
    termId: "",
    subjects,
    sections,
    subjectTotals,
  };
}

export function AcademicHeatmap() {
  const { gradeMode } = useGradeMode();
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(false);
  const [data, setData] = React.useState<AcademicHeatmapData | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    apiClient
      .get<BackendAcademicSummary>("/api/academics", { params: { mode: gradeMode } })
      .then((res) => {
        if (cancelled) return;
        setData(normalizeAcademic(res.data));
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        console.error("[/api/academics] fetch failed:", err);
        setError(true);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [gradeMode]);

  const sections = data?.sections ?? [];
  const totals = data?.subjectTotals ?? [];

  // Group sections by grade so the matrix renders as separate per-grade cards.
  // Each grade only shows the subjects offered in that grade, with sections as
  // vertical columns (subjects as rows) and cells = student count below 75.
  const groupedByGrade = React.useMemo(() => {
    const map = new Map<string, typeof sections>();
    for (const s of sections) {
      const arr = map.get(s.gradeLevel) ?? [];
      arr.push(s);
      map.set(s.gradeLevel, arr);
    }
    return Array.from(map.entries())
      .map(([grade, secs]) => {
        const subjSet = new Set<string>();
        secs.forEach((sec) => sec.cells.forEach((c) => subjSet.add(c.subject)));
        return { grade, sections: secs, subjects: Array.from(subjSet).sort() };
      })
      .sort((a, b) => Number(a.grade.replace(/\D/g, "")) - Number(b.grade.replace(/\D/g, "")));
  }, [sections]);

  // Total distinct students (across all sections) with at least one subject below 75.
  const studentsBelowTotal = sections.reduce((a, s) => a + (s.studentsBelow ?? 0), 0);
  const sectionsAtRisk = sections.filter((s) => s.anyAtRisk).length;
  const worst = totals[0];

  return (
    <section className={styles.board}>
      <div className={styles.statRow}>
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className={`${styles.tile}`}>
              <Skeleton className={styles.tileIconSkel} />
              <div className={styles.tileBody}>
                <Skeleton className={styles.tileValueSkel} />
                <Skeleton className={styles.tileLabelSkel} />
                <Skeleton className={styles.tileHintSkel} />
              </div>
            </div>
          ))
        ) : error ? (
          <div className={`${styles.tile}`}>
            <span className={styles.tileIcon}>
              <AlertTriangle size={18} />
            </span>
            <div className={styles.tileBody}>
              <span className={styles.tileValue}>—</span>
              <span className={styles.tileLabel}>Unable to load</span>
              <span className={styles.tileHint}>check your connection</span>
            </div>
          </div>
        ) : (
          <>
            <BlobCard className={`${styles.tile} ${styles.tile_warn}`}>
              <span className={styles.tileIcon}>
                <AlertTriangle size={18} />
              </span>
              <div className={styles.tileBody}>
                <span className={styles.tileValue}>{studentsBelowTotal}</span>
                <span className={styles.tileLabel}>Students below 75</span>
                <span className={styles.tileHint}>
                  {gradeMode === "final" ? "finalized grades" : "all graded rows"}
                </span>
              </div>
            </BlobCard>

            <BlobCard className={`${styles.tile} ${styles.tile_neutral}`}>
              <span className={styles.tileIcon}>
                <BookOpen size={18} />
              </span>
              <div className={styles.tileBody}>
                <span className={styles.tileValue}>{sectionsAtRisk}</span>
                <span className={styles.tileLabel}>Sections with at-risk</span>
                <span className={styles.tileHint}>≥1 learner below 75</span>
              </div>
            </BlobCard>

            <BlobCard className={`${styles.tile} ${styles.tile_hot}`}>
              <span className={styles.tileIcon}>
                <Flame size={18} />
              </span>
              <div className={styles.tileBody}>
                <span className={styles.tileValue}>
                  {worst ? worst.subject : "—"}
                </span>
                <span className={styles.tileLabel}>Highest failure subject</span>
                <span className={styles.tileHint}>
                  {worst ? `${worst.below75Count} students` : "status-only"}
                </span>
              </div>
            </BlobCard>
          </>
        )}
      </div>

      <div className={styles.split}>
        <div className={`${styles.panel} ${styles.barePanel}`}>
          <h3 className={styles.panelTitle}>Section × Subject — students below 75</h3>
          {loading ? (
            <div className={styles.gradeMatrix}>
              <Skeleton className={styles.matrixGradeHeadSkel} />
              <div className={styles.matrixScroll}>
                <div
                  className={styles.matrix}
                  style={{
                    gridTemplateColumns: `minmax(96px, auto) repeat(${8}, minmax(0, 1fr))`,
                  }}
                >
                  <span className={styles.matrixCorner} />
                  {Array.from({ length: 8 }).map((_, i) => (
                    <Skeleton key={i} className={styles.matrixColHeadSkel} />
                  ))}
                  {Array.from({ length: 8 }).map((_, r) => (
                    <React.Fragment key={r}>
                      <Skeleton className={styles.matrixRowHeadSkel} />
                      {Array.from({ length: 8 }).map((_, c) => (
                        <Skeleton key={c} className={styles.matrixCellSkel} />
                      ))}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            </div>
          ) : error ? (
            <p className={styles.panelEmpty}>Could not load academic data.</p>
          ) : groupedByGrade.length === 0 ? (
            <p className={styles.panelEmpty}>No graded records for the active term.</p>
          ) : (
            groupedByGrade.map(({ grade, sections: gradeSections, subjects: gradeSubjects }) => (
              <div key={grade} className={styles.gradeMatrix}>
                <p className={styles.matrixGradeHead}>{grade}</p>
                <div className={styles.matrixScroll}>
                  <div
                    className={styles.matrix}
                    style={{
                      gridTemplateColumns: `minmax(96px, auto) repeat(${gradeSubjects.length}, minmax(0, 1fr))`,
                    }}
                  >
                    <span className={styles.matrixCorner} />
                    {gradeSubjects.map((subj) => (
                      <span key={subj} className={styles.matrixColHead}>
                        {subj}
                      </span>
                    ))}
                    {gradeSections.map((s) => (
                      <React.Fragment key={s.sectionId}>
                        <span className={styles.matrixRowHead}>{s.section}</span>
                        {gradeSubjects.map((subj) => {
                          const cell = s.cells.find((c) => c.subject === subj);
                          const count = cell?.below75Count ?? 0;
                          return (
                            <span
                              key={subj}
                              className={styles.matrixCell}
                              style={{
                                background: cellColor(count),
                                color: cellText(count),
                              }}
                              title={
                                cell
                                  ? `${s.section} · ${subj}: ${count} student(s) below 75`
                                  : `${s.section} · ${subj}: no data`
                              }
                            >
                              {count}
                            </span>
                          );
                        })}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className={styles.legend}>
        <span className={styles.legendLabel}>Students below 75:</span>
        <span className={styles.legendScale}>
          {SCALE.map((c, i) => (
            <span
              key={i}
              className={styles.legendSwatch}
              style={{ background: c }}
            />
          ))}
        </span>
        <span className={styles.legendNote}>
          Confidential source hidden — status-only counts.
        </span>
      </div>
    </section>
  );
}
