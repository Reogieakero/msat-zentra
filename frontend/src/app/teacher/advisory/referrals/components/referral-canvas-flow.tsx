"use client";
import { Fragment } from "react";
import styles from "./ReferralCanvas.module.css";
import type { Stage } from "./referral-canvas-types";
export function ReferralCanvasFlow({ stages, onSelect }: { stages: Stage[]; onSelect: (index: number) => void }) {
  const perRow = stages.length <= 5 ? stages.length : 4;
  const rows: { stage: Stage; index: number }[][] = [];
  stages.forEach((stage, index) => {
    const r = Math.floor(index / perRow);
    (rows[r] ??= []).push({ stage, index });
  });
  function edgeLit(i: number): boolean {
    const s = stages[i].state;
    return s === "done" || (s === "current" && (i === 0 || stages[i - 1].state === "done"));
  }
  return (
    <div className={styles.flow}>
      {rows.map((row, r) => (
        <ol
          key={r}
          className={styles.row}
          style={{
            gridTemplateColumns: `repeat(${row.length - 1}, minmax(0, 1fr) auto) minmax(0, 1fr)`,
          }}
          aria-label={rows.length > 1 ? `Referral progress, row ${r + 1}` : "Referral progress"}
        >
          {row.map(({ stage, index: i }) => {
            const Icon = stage.Icon;
            const lit = edgeLit(i);
            const stateText =
              stage.state === "done" ? "Done" : stage.state === "current" ? "Current" : "Queued";
            const stateClass =
              stage.state === "done"
                ? styles.stateDone
                : stage.state === "current"
                  ? styles.stateCurrent
                  : styles.stateTodo;
            return (
              <Fragment key={stage.key}>
                {i % perRow !== 0 && (
                  <li className={styles.edge} aria-hidden>
                    <span className={`${styles.wire} ${lit ? styles.wireLit : ""}`} />
                    <span className={`${styles.head} ${lit ? styles.headLit : ""}`} />
                  </li>
                )}
                <li className={styles.nodeItem}>
                  <button
                    type="button"
                    className={`${styles.node} ${stage.state === "done" ? styles.nodeDone : ""} ${stage.state === "current" ? styles.nodeCurrent : ""} ${stage.state === "todo" ? styles.nodeTodo : ""}`}
                    title={`${stage.label} — view step details`}
                    onClick={() => onSelect(i)}
                    aria-haspopup="dialog"
                  >
                    <span
                      className={`${styles.tile} ${stage.state === "done" ? styles.tileDone : ""} ${stage.state === "current" ? styles.tileCurrent : ""}`}
                      aria-hidden
                    >
                      <Icon />
                    </span>
                    <span className={styles.nodeText}>
                      <span className={styles.nodeStep}>
                        Step {i + 1} of {stages.length}
                      </span>
                      <span className={styles.nodeLabel}>
                        {stage.label}
                        {stage.optional ? <span className={styles.opt}> (optional)</span> : null}
                      </span>
                      <span className={styles.nodeSub}>{stage.sub}</span>
                      {stage.principalAction ? (
                        <span className={styles.nodeSub}>Principal action</span>
                      ) : null}
                    </span>
                    <span className={`${styles.stateTag} ${stateClass}`}>{stateText}</span>
                  </button>
                </li>
              </Fragment>
            );
          })}
        </ol>
      ))}
    </div>
  );
}
