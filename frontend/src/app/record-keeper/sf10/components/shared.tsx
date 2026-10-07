import * as React from "react";
import { Badge } from "@/components/ui/badge";
import type { Sf10Status } from "../types";

export function formatRelativeTime(iso: string | null): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const diffMs = Date.now() - then;
  const sec = Math.round(diffMs / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  return `${day}d ago`;
}

export function StatusBadge({ status }: { status: Sf10Status }) {
  const variant =
    status === "released" ? "secondary" : status === "available" ? "default" : "warning";
  const label =
    status === "released" ? "Released" : status === "available" ? "Available" : "Attached";
  return (
    <Badge variant={variant} className="font-normal">
      {label}
    </Badge>
  );
}
