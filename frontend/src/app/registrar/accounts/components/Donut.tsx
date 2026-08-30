import * as React from "react";
import styles from "./donut.module.css";

type Props = {
  withAccount: number;
  pending: number;
};

const COLORS = {
  withAccount: "var(--primary)",
  pending: "var(--warn, #d97706)",
};

export function Donut({ withAccount, pending }: Props) {
  const total = withAccount + pending;
  const size = 96;
  const stroke = 12;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  const segments = [
    { value: withAccount, color: COLORS.withAccount },
    { value: pending, color: COLORS.pending },
  ].filter((s) => s.value > 0);

  let offset = 0;

  return (
    <div className={styles.wrap}>
      <svg
        className={styles.svg}
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label="Account status distribution"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--border)"
          strokeWidth={stroke}
        />
        {total > 0
          ? segments.map((s, i) => {
              const dash = (s.value / total) * circumference;
              const seg = (
                <circle
                  key={i}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={stroke}
                  strokeDasharray={`${dash} ${circumference - dash}`}
                  strokeDashoffset={-offset}
                  transform={`rotate(-90 ${size / 2} ${size / 2})`}
                />
              );
              offset += dash;
              return seg;
            })
          : null}
      </svg>
      <span className={styles.center}>{total}</span>
    </div>
  );
}
