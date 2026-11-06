"use client";

import { Pencil } from "lucide-react";
import type { ComponentType } from "@/services/teacher/grading.types";
import styles from "./WeightsVisual.module.css";

type Props = {
  ww: number;
  pt: number;
  exam: number;
  showBar?: boolean;
  /** When provided, cards become editable: values render from inputs. */
  inputs?: Record<ComponentType, string>;
  editing?: ComponentType | null;
  onStartEdit?: (t: ComponentType) => void;
  onInputChange?: (t: ComponentType, v: string) => void;
  onEndEdit?: () => void;
};

function Card({
  label,
  dotClass,
  type,
  value,
  inputs,
  editing,
  onStartEdit,
  onInputChange,
  onEndEdit,
}: {
  label: string;
  dotClass: string;
  type: ComponentType;
  value: number;
  inputs?: Record<ComponentType, string>;
  editing?: ComponentType | null;
  onStartEdit?: (t: ComponentType) => void;
  onInputChange?: (t: ComponentType, v: string) => void;
  onEndEdit?: () => void;
}) {
  const isEditing = inputs !== undefined && editing === type;
  const display = inputs !== undefined ? (inputs[type] === "" ? "0" : inputs[type]) : String(value);
  return (
    <li className={styles.segRow}>
      <span className={styles.segTop}>
        <span className={styles.segName}>{label}</span>
        <span className={`${styles.segDot} ${dotClass}`} aria-hidden />
      </span>
      <span className={styles.segBottom}>
        {inputs !== undefined && onStartEdit ? (
          <button
            type="button"
            className={styles.segEdit}
            onClick={() => onStartEdit(type)}
            aria-label={`Edit ${label} weight`}
            title={`Edit ${label} weight`}
          >
            <Pencil size={12} aria-hidden />
          </button>
        ) : null}
        {isEditing ? (
          <input
            autoFocus
            className={styles.segValueInput}
            inputMode="numeric"
            aria-label={`${label} weight percent`}
            value={inputs[type]}
            onChange={(e) => onInputChange?.(type, e.target.value)}
            onBlur={() => onEndEdit?.()}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              if (e.key === "Escape") onEndEdit?.();
            }}
            onFocus={(e) => e.target.select()}
          />
        ) : (
          <span className={styles.segValue}>{display}%</span>
        )}
      </span>
    </li>
  );
}

export function WeightsVisual({ ww, pt, exam, showBar = true, inputs, editing, onStartEdit, onInputChange, onEndEdit }: Props) {
  const parsedInputs =
    inputs !== undefined
      ? (["WRITTEN_WORK", "PERFORMANCE_TASK", "EXAM"] as const).map((t) => Number(inputs[t]))
      : null;
  const total =
    parsedInputs !== null && parsedInputs.every((n) => Number.isFinite(n))
      ? parsedInputs.reduce((s, n) => s + n, 0)
      : ww + pt + exam;
  const cardProps = { inputs, editing, onStartEdit, onInputChange, onEndEdit };
  return (
    <>
      {showBar ? (
      <div
        className={styles.segBar}
        role="img"
        aria-label={`Written Work ${ww} percent, Performance Task ${pt} percent, Exam ${exam} percent`}
      >
        <div className={`${styles.seg} ${styles.segWW}`} style={{ width: `${ww}%` }} />
        <div className={`${styles.seg} ${styles.segPT}`} style={{ width: `${pt}%` }} />
        <div className={`${styles.seg} ${styles.segQE}`} style={{ width: `${exam}%` }} />
      </div>
      ) : null}
      <ul className={styles.segLegend}>
        <Card label="Written Work" dotClass={styles.segWW} type="WRITTEN_WORK" value={ww} {...cardProps} />
        <Card label="Performance Task" dotClass={styles.segPT} type="PERFORMANCE_TASK" value={pt} {...cardProps} />
        <Card label="Exam" dotClass={styles.segQE} type="EXAM" value={exam} {...cardProps} />
      </ul>
      <p className={total === 100 ? styles.segTotalOk : styles.segTotalBad}>
        {total === 100
          ? `Total ${total}% — balanced per DepEd.`
          : `Total ${total}% — weights must equal 100%.`}
      </p>
    </>
  );
}
