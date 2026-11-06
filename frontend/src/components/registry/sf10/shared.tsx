import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Sf10Status } from "@/services/registry/sf10.types";

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

/** Status color coding, same as the desk KPI accents: attached is amber
 * (in flight), released is green (archived). */
export function StatusBadge({ status, className }: { status: Sf10Status; className?: string }) {
  const variant = status === "released" ? "green" : "amber";
  const label = status === "released" ? "Released" : "Attached";
  return (
    <Badge variant={variant} className={cn("font-normal", className)}>
      {label}
    </Badge>
  );
}

/**
 * Display a subject name without its grade tag: "English 8" → "English".
 * Matching already ignores these tags; display should too.
 */
export function displaySubjectName(name: string): string {
  const stripped = name
    .replace(/\s+(g\s*)?(7|8|9|10|11|12|vii|viii|ix|x|xi|xii)\s*$/i, "")
    .trim();
  return stripped || name;
}
