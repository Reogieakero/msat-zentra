"use client";
const PASS_DOT = "#22c55e";
const FAIL_DOT = "#ef4444";
export function dotFor(grade: string, radius: number) {
  function TrendDot(props: {
    cx?: number;
    cy?: number;
    payload?: Record<string, unknown>;
  }) {
    const { cx, cy, payload } = props;
    if (cx == null || cy == null) return <g />;
    const raw = payload ? payload[grade] : null;
    if (typeof raw !== "number") return <g />;
    const bad = raw < 75;
    return (
      <circle
        cx={cx}
        cy={cy}
        r={bad ? radius + 1 : radius}
        style={{
          fill: bad ? FAIL_DOT : PASS_DOT,
          stroke: "var(--card)",
        }}
        strokeWidth={2}
      />
    );
  }
  return TrendDot;
}
export function EmptyDot(props: { cx?: number; cy?: number }) {
  const { cx, cy } = props;
  if (cx == null || cy == null) return <g />;
  return (
    <circle
      cx={cx}
      cy={cy}
      r={4}
      style={{ fill: "#ffffff", stroke: "var(--muted-foreground)" }}
      strokeWidth={1.5}
      strokeDasharray="2 2"
    />
  );
}
