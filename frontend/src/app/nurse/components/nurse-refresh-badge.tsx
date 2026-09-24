"use client";

import { Loader2 } from "lucide-react";

/**
 * Non-blocking background-refresh indicator for the nurse desk.
 * Rendered only when the page already shows data (`!isPending && isFetching`).
 * Never replaces content — keeps layout stable and announces politely.
 */
export function NurseRefreshBadge({ label = "Refreshing…" }: { label?: string }) {
  return (
    <p
      role="status"
      aria-live="polite"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.375rem",
        margin: 0,
        fontSize: "0.75rem",
        color: "var(--muted-foreground)",
        fontVariantNumeric: "tabular-nums",
      }}
    >
      <Loader2
        aria-hidden="true"
        style={{ width: "0.875rem", height: "0.875rem" }}
        className="animate-spin"
      />
      {label}
    </p>
  );
}
