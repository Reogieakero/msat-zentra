"use client";

import * as React from "react";
import styles from "./WeightsVisual.module.css";

type Props = {
  ww: number;
  pt: number;
  qe: number;
};

/** Proportional WW/PT/QE bar with legend — shared by the weights and solution modals. */
export function WeightsVisual({ ww, pt, qe }: Props) {
  const total = ww + pt + qe;
  return (
    <>
      <div
        className={styles.segBar}
        role="img"
        aria-label={`Written Work ${ww} percent, Performance Task ${pt} percent, Quarterly Exam ${qe} percent`}
      >
        <div className={`${styles.seg} ${styles.segWW}`} style={{ width: `${ww}%` }} />
        <div className={`${styles.seg} ${styles.segPT}`} style={{ width: `${pt}%` }} />
        <div className={`${styles.seg} ${styles.segQE}`} style={{ width: `${qe}%` }} />
      </div>
      <ul className={styles.segLegend}>
        <li className={styles.segRow}>
          <span className={`${styles.segDot} ${styles.segWW}`} aria-hidden />
          <div className={styles.segText}>
            <span className={styles.segName}>
              Written Work <b>{ww}%</b>
            </span>
            <span className={styles.segMean}>Quizzes, seatwork, assignments</span>
          </div>
        </li>
        <li className={styles.segRow}>
          <span className={`${styles.segDot} ${styles.segPT}`} aria-hidden />
          <div className={styles.segText}>
            <span className={styles.segName}>
              Performance Task <b>{pt}%</b>
            </span>
            <span className={styles.segMean}>Projects, performances, group work</span>
          </div>
        </li>
        <li className={styles.segRow}>
          <span className={`${styles.segDot} ${styles.segQE}`} aria-hidden />
          <div className={styles.segText}>
            <span className={styles.segName}>
              Quarterly Exam <b>{qe}%</b>
            </span>
            <span className={styles.segMean}>Periodical exam</span>
          </div>
        </li>
      </ul>
      <p className={total === 100 ? styles.segTotalOk : styles.segTotalBad}>
        {total === 100
          ? `Total ${total}% — balanced per DepEd.`
          : `Total ${total}% — weights must equal 100%.`}
      </p>
    </>
  );
}
