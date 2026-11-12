import { Pill, type PillTone } from "@/components/ui/pill";
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
 * (in flight), available is blue, released is green (archived). Rendered with
 * the shared pill so it matches every other desk badge. */
export function StatusBadge({
  status,
  className,
}: {
  status: Sf10Status;
  className?: string;
}) {
  const tone: PillTone =
    status === "released" ? "green" : status === "available" ? "blue" : "amber";
  const label =
    status === "released" ? "Released" : status === "available" ? "Available" : "Attached";
  return (
    <Pill tone={tone} label="Record status" className={className}>
      {label}
    </Pill>
  );
}

/**
 * Adviser read-access grant (adviser-access desk). Deliberately separate
 * from {@link StatusBadge}: releasing an SF10 means issuing it to another
 * school, while an adviser grant only opens read access — never a release.
 */
export function AdviserAccessBadge({ className }: { className?: string }) {
  return (
    <Pill tone="violet" label="Adviser access granted" className={className}>
      Adviser access
    </Pill>
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
