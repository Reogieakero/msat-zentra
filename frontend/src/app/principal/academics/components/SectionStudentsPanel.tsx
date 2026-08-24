"use client";

import * as React from "react";
import type { SectionSummary, StudentRow, StudentSubject } from "../mockData";
import { SUBJECT_CODES } from "../mockData";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import styles from "./SectionStudentsPanel.module.css";
import shared from "../academics.module.css";

interface Props {
  section: SectionSummary | null;
  subjects: string[];
  onSelectStudent: (student: StudentRow) => void;
  onHoverStudent?: (student: StudentRow | null) => void;
  loading?: boolean;
}

type Dot = "pass" | "partial" | "fail";

function dotFor(sub: StudentSubject): Dot {
  const g = sub.transmutedGrade;
  if (g > 80) return "pass";
  if (g >= 75) return "partial";
  return "fail";
}

export function SectionStudentsPanel({
  section,
  subjects,
  onSelectStudent,
  onHoverStudent,
  loading,
}: Props) {
  const hoverTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearHoverTimer = () => {
    if (hoverTimer.current) {
      clearTimeout(hoverTimer.current);
      hoverTimer.current = null;
    }
  };

  React.useEffect(() => clearHoverTimer, []);

  const handleEnter = (st: StudentRow) => {
    clearHoverTimer();
    hoverTimer.current = setTimeout(() => onHoverStudent?.(st), 60);
  };

  const handleLeave = () => {
    clearHoverTimer();
    hoverTimer.current = setTimeout(() => onHoverStudent?.(null), 120);
  };
  if (loading) {
    return (
      <div className={shared.tableWrap}>
        <table className={styles.dotTable}>
          <thead>
            <tr>
              <th className={styles.diagCell}>LRN</th>
              {subjects.map((subj) => (
                <th key={subj} className={styles.codeHeader} title={subj}>
                  {SUBJECT_CODES[subj] ?? subj}
                </th>
              ))}
              <th className={styles.diagCell} aria-label="View" />
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 8 }).map((_, r) => (
              <tr key={r} className={styles.studentRow}>
                <td className={`${shared.mono} ${styles.diagCell} ${styles.lrnCell}`}>
                  <Skeleton className={styles.lrnSkeleton} />
                </td>
                {subjects.map((subj) => (
                  <td key={subj} className={`${styles.diagCell} ${styles.dotCell}`}>
                    <Skeleton className={styles.dotSkeleton} />
                  </td>
                ))}
                <td className={`${styles.diagCell} ${styles.viewCell}`}>
                  <Skeleton className={styles.viewSkeleton} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (!section) {
    return (
      <div className={shared.tableWrap}>
        <p className={shared.empty}>Select a section to view its students.</p>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className={shared.tableWrap}>
        <table className={styles.dotTable}>
          <thead>
            <tr>
              <th className={styles.diagCell}>LRN</th>
              {subjects.map((subj) => (
                <th key={subj} className={styles.codeHeader} title={subj}>
                  {SUBJECT_CODES[subj] ?? subj}
                </th>
              ))}
              <th className={styles.diagCell} aria-label="View" />
            </tr>
          </thead>
          <tbody>
            {section.students.map((st) => (
              <tr
                key={st.studentId}
                className={styles.studentRow}
                onClick={() => onSelectStudent(st)}
                onMouseEnter={() => handleEnter(st)}
                onMouseLeave={handleLeave}
              >
                <td className={`${shared.mono} ${styles.diagCell} ${styles.lrnCell}`}>
                  {st.lrn}
                </td>
                {subjects.map((subj) => {
                  const sub = st.subjects.find((s) => s.subject === subj);
                  const dot = sub ? dotFor(sub) : null;
                  const status =
                    dot === "pass"
                      ? "On track"
                      : dot === "partial"
                        ? "At risk"
                        : "Low";
                  return (
                    <td key={subj} className={`${styles.diagCell} ${styles.dotCell}`}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span
                            className={`${shared.dot} ${
                              dot === "pass"
                                ? shared.dotPass
                                : dot === "partial"
                                  ? shared.dotPartial
                                  : shared.dotFail
                            }`}
                          />
                        </TooltipTrigger>
                        <TooltipContent>
                          {sub
                            ? `${subj} — Partial grade: ${sub.transmutedGrade} (partial)`
                            : `${subj}: no data`}
                        </TooltipContent>
                      </Tooltip>
                      <span className={styles.srOnly}>{status}</span>
                    </td>
                  );
                })}
                <td className={`${styles.diagCell} ${styles.viewCell}`}>
                  <span className={styles.clickHint}>View →</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </TooltipProvider>
  );
}
