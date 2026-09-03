import * as React from "react";
import styles from "./subject-donut.module.css";

type Props = {
  passed: number;
  failed: number;
};

export function SubjectDonut({ passed, failed }: Props) {
  const total = passed + failed;
  const size = 84;
  const stroke = 11;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  const segments = [
    { value: passed, color: "var(--primary)" },
    { value: failed, color: "var(--destructive)" },
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
        aria-label="Pass and fail distribution"
      >
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--border)" strokeWidth={stroke} />
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
