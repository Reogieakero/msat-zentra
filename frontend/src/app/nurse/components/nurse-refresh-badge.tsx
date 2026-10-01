"use client";

import { Loader2 } from "lucide-react";

/**
 * Non-blocking background-refresh indicator for the nurse desk.
 * Rendered only when the page already shows data (`!isPending && isFetching`).
 * Floats above the content (fixed pill) so appearing/disappearing never
 * shifts the layout — the table keeps its exact 16px gap from the navbar.
 * Never replaces content — keeps layout stable and announces politely.
 */
export function NurseRefreshBadge({ label = "Refreshing…" }: { label?: string }) {
  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        top: "3.5rem",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 45,
        pointerEvents: "none",
      }}
    >
      <p
        role="status"
        aria-live="polite"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "0.375rem",
          margin: 0,
          padding: "0.375rem 0.75rem",
          borderRadius: "9999px",
          border: "1px solid var(--border)",
          backgroundColor: "var(--card)",
          boxShadow: "0 8px 24px -8px rgba(0, 0, 0, 0.25)",
          fontSize: "0.75rem",
          color: "var(--muted-foreground)",
          fontVariantNumeric: "tabular-nums",
          whiteSpace: "nowrap",
        }}
      >
        <Loader2
          aria-hidden="true"
          style={{ width: "0.875rem", height: "0.875rem" }}
          className="animate-spin"
        />
        {label}
      </p>
    </div>
  );
}
