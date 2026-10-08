export const DOT = {
  green: "#22c55e",
  yellow: "#eab308",
  red: "#ef4444",
  gray: "#9ca3af",
  blue: "#3b82f6",
} as const;

export type StatusKind = "success" | "warning" | "error" | "idle" | "progress";

export const STATUS_META: Record<StatusKind, { color: (typeof DOT)[keyof typeof DOT]; label: string }> = {
  success: { color: DOT.green, label: "Success" },
  warning: { color: DOT.yellow, label: "Warning" },
  error: { color: DOT.red, label: "Error" },
  idle: { color: DOT.gray, label: "No status" },
  progress: { color: DOT.blue, label: "In progress" },
};
