import * as React from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import styles from "./donut.module.css";

type Props = {
  withAccount: number;
  pending: number;
  noAccount?: number;
};

const COLORS = {
  withAccount: "var(--primary)",
  pending: "color-mix(in oklch, var(--primary) 65%, var(--card))",
  noAccount: "color-mix(in oklch, var(--primary) 35%, var(--card))",
};

export function Donut({ withAccount, pending, noAccount = 0 }: Props) {
  const total = withAccount + pending + noAccount;
  const size = 96;
  const stroke = 12;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const [hovered, setHovered] = React.useState<number | null>(null);

  const segments = [
    { label: "With account", value: withAccount, color: COLORS.withAccount },
    { label: "Pending", value: pending, color: COLORS.pending },
    { label: "No account", value: noAccount, color: COLORS.noAccount },
  ].filter((s) => s.value > 0);

  let offset = 0;

  const active = hovered !== null ? segments[hovered] : null;

  return (
    <div className={styles.wrap}>
      <TooltipProvider delayDuration={0}>
        <svg
          className={styles.svg}
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          role="img"
          aria-label={`Account status distribution: ${segments
            .map((s) => `${s.label} ${s.value}`)
            .join(", ") || "no records"}`}
          onMouseLeave={() => setHovered(null)}
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
                const pct = Math.round((s.value / total) * 100);
                const seg = (
                  <Tooltip key={i}>
                    <TooltipTrigger asChild>
                      <circle
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        fill="none"
                        stroke={s.color}
                        strokeWidth={hovered === i ? stroke + 3 : stroke}
                        strokeDasharray={`${dash} ${circumference - dash}`}
                        strokeDashoffset={-offset}
                        transform={`rotate(-90 ${size / 2} ${size / 2})`}
                        style={{ cursor: "pointer", transition: "stroke-width 120ms ease-out" }}
                        onMouseEnter={() => setHovered(i)}
                        onFocus={() => setHovered(i)}
                        onBlur={() => setHovered(null)}
                        tabIndex={0}
                        aria-label={`${s.label}: ${s.value} of ${total}`}
                      />
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      <span
                        className={styles.tooltipSwatch}
                        style={{ backgroundColor: s.color }}
                        aria-hidden="true"
                      />
                      {s.label}: {s.value} ({pct}%)
                    </TooltipContent>
                  </Tooltip>
                );
                offset += dash;
                return seg;
              })
            : null}
        </svg>
      </TooltipProvider>
      <span className={styles.center} aria-hidden="true">
        {active ? active.value : total}
      </span>
    </div>
  );
}
