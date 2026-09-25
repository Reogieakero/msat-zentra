"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  COMPONENT_NAMES,
  COMPONENT_ORDER,
  type ClassComponent,
  type ComponentType,
} from "../../components/grading-data";
import styles from "./AllAssessmentsDialog.module.css";

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

type Props = {
  components: ClassComponent[];
  onClose: () => void;
  onOpenAssessment: (category: ComponentType, assessmentId: string) => void;
};

export function AllAssessmentsDialog({ components, onClose, onOpenAssessment }: Props) {
  const total = components.reduce((s, c) => s + c.assessments.length, 0);

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className={styles.dialog}>
        <DialogHeader>
          <DialogTitle>All assessments</DialogTitle>
          <DialogDescription>
            {total === 0
              ? "No assessments recorded for this subject yet."
              : `${total} assessment${total === 1 ? "" : "s"} recorded for this subject.`}
          </DialogDescription>
        </DialogHeader>

        <div className={styles.groups}>
          {COMPONENT_ORDER.map((t) => {
            const list =
              components.find((c) => c.type === t)?.assessments.slice().sort(
                (a, b) => +new Date(b.dateGiven) - +new Date(a.dateGiven)
              ) ?? [];
            return (
              <section key={t} className={styles.group}>
                <h3 className={styles.groupTitle}>
                  {SHORT[t]} {COMPONENT_NAMES[t]}
                  <span className={styles.groupCount}>{list.length}</span>
                </h3>
                {list.length === 0 ? (
                  <p className={styles.empty}>None yet.</p>
                ) : (
                  <ul className={styles.list}>
                    {list.map((a) => (
                      <li key={a.id}>
                        <button
                          type="button"
                          className={styles.rowBtn}
                          onClick={() => onOpenAssessment(t, a.id)}
                        >
                          <span className={`${styles.dot} ${DOT[t]}`} aria-hidden />
                          <span className={styles.rowText}>
                            <span className={styles.rowTitle}>{a.title}</span>
                            <span className={styles.rowMeta}>Given {a.dateGiven}</span>
                          </span>
                          <span className={styles.rowMax}>
                            <span className={styles.rowMaxValue}>{a.maxScore}</span>
                            <span className={styles.rowMaxLabel}>max</span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
