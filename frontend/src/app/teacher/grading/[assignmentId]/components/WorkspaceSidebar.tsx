"use client";

import * as React from "react";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  COMPONENT_NAMES,
  COMPONENT_ORDER,
  type ClassComponent,
  type ComponentType,
} from "../../components/grading-data";
import { AllAssessmentsDialog } from "./AllAssessmentsDialog";
import styles from "./WorkspaceSidebar.module.css";

const DOT: Record<string, string> = {
  WRITTEN_WORK: styles.dotWW,
  PERFORMANCE_TASK: styles.dotPT,
  QUARTERLY_EXAM: styles.dotQE,
};

const SHORT: Record<string, string> = {
  WRITTEN_WORK: "WW",
  PERFORMANCE_TASK: "PT",
  QUARTERLY_EXAM: "QE",
};

type RecentItem = {
  id: string;
  title: string;
  type: ComponentType;
  dateGiven: string;
  maxScore: number;
};

export type WorkspaceView = "scores" | "finals";

type Props = {
  assignmentId: string;
  components: ClassComponent[];
  studentCount: number;
  view: WorkspaceView;
  onSelectView: (view: WorkspaceView) => void;
  onOpenAssessment: (category: ComponentType, assessmentId: string) => void;
  onOpenWeights: () => void;
  onAddAssessment: () => void;
};

export function WorkspaceSidebar({
  assignmentId,
  components,
  studentCount,
  view,
  onSelectView,
  onOpenAssessment,
  onOpenWeights,
  onAddAssessment,
}: Props) {
  const [allOpen, setAllOpen] = React.useState(false);
  const weightOf = (type: string) => components.find((c) => c.type === type)?.weight ?? 0;

  const recent: RecentItem[] = React.useMemo(() => {
    const all = components.flatMap((c) =>
      c.assessments.map((a) => ({
        id: a.id,
        title: a.title,
        type: c.type,
        dateGiven: a.dateGiven,
        maxScore: a.maxScore,
      }))
    );
    return all
      .sort((a, b) => +new Date(b.dateGiven) - +new Date(a.dateGiven))
      .slice(0, 3);
  }, [components]);

  return (
    <aside className={styles.sidebar} aria-label="Class tools">
      <div className={styles.card}>
        <h2 className={styles.cardTitle}>Subject weights</h2>
        <ul className={styles.weightList}>
          {COMPONENT_ORDER.map((t) => (
            <li key={t} className={styles.weightRow}>
              <span className={`${styles.dot} ${DOT[t]}`} aria-hidden />
              <span className={styles.weightName}>
                {SHORT[t]} · {COMPONENT_NAMES[t]}
              </span>
              <span className={styles.weightValue}>{weightOf(t)}%</span>
            </li>
          ))}
        </ul>
        <div className={styles.actions}>
          <Button variant="outline" size="sm" className={styles.actionBtn} onClick={onOpenWeights}>
            Weights
          </Button>
          <Button size="sm" className={styles.actionBtn} onClick={onAddAssessment}>
            Add assessment
          </Button>
          <Button variant="outline" size="sm" className={styles.actionBtn} asChild>
            <a href={`/record/${assignmentId}`} target="_blank" rel="noopener noreferrer">
              Class record
            </a>
          </Button>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.recentHead}>
          <h2 className={styles.cardTitle}>Recent assessments</h2>
          <Button
            variant="outline"
            className={styles.viewAllBtn}
            onClick={() => setAllOpen(true)}
          >
            View all
          </Button>
        </div>
        {recent.length === 0 ? (
          <p className={styles.empty}>No assessments yet.</p>
        ) : (
          <ul className={styles.recentList}>
            {recent.map((a) => (
              <li key={a.id}>
                <button
                  type="button"
                  className={styles.rowBtn}
                  onClick={() => onOpenAssessment(a.type, a.id)}
                >
                  <span className={`${styles.dot} ${DOT[a.type]}`} aria-hidden />
                  <span className={styles.recentText}>
                    <span className={styles.recentTitle}>
                      {SHORT[a.type]} {a.title}
                    </span>
                    <span className={styles.recentMeta}>
                      Given {a.dateGiven}
                    </span>
                  </span>
                  <span className={styles.recentMax}>
                    <span className={styles.recentMaxValue}>{a.maxScore}</span>
                    <span className={styles.recentMaxLabel}>max</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

        <button
          type="button"
          className={styles.bannerCard}
          onClick={() => onSelectView(view === "finals" ? "scores" : "finals")}
          aria-current={view === "finals" ? "true" : undefined}
        >
          <span className={styles.bannerTop}>
            <span className={styles.bannerTitle}>Final grades</span>
            <span className={styles.bannerCount}>{studentCount}</span>
          </span>
          <span className={styles.bannerSub}>
            {studentCount} student{studentCount === 1 ? "" : "s"} records
          </span>
          <span className={styles.bannerAction}>
            See final grades
            <ChevronRight className={styles.bannerActionIcon} aria-hidden />
          </span>
        </button>

      {allOpen ? (
        <AllAssessmentsDialog
          components={components}
          onClose={() => setAllOpen(false)}
          onOpenAssessment={(category, assessmentId) => {
            setAllOpen(false);
            onOpenAssessment(category, assessmentId);
          }}
        />
      ) : null}
    </aside>
  );
}
