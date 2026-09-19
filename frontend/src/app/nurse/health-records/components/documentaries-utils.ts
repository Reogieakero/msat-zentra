import {
  NURSE_STATUS_LABELS,
  type ClinicAttachment,
  type NurseQueueRow,
  type NurseSessionItem,
} from "../../overview/components/nurse-overview-data";
import type { NurseAlertItem } from "../../alerts/components/nurse-alerts-data";

export interface DocEntry {
  key: string;
  row: NurseQueueRow;
  session: NurseSessionItem | null;
  dateDay: string;
  sortTime: number;
  details: string;
  outcome: string;
  files: ClinicAttachment[];
  isEndorse: boolean;
}

export type TypeFilter = "" | "ADM" | "Clinic";
export type SortKey = "referral" | "student" | "date" | "status";

const TYPE_OPTIONS: { value: TypeFilter; label: string }[] = [
  { value: "", label: "All types" },
  { value: "ADM", label: "ADM" },
  { value: "Clinic", label: "Clinic" },
];

const PAGE_SIZE = 10;

export function buildEntries(alerts: NurseAlertItem[]): DocEntry[] {
  const entries: DocEntry[] = [];
  for (const alert of alerts) {
    const row = alert.row;
    const done = row.sessions.filter((s) => s.status === "completed");
    if (done.length > 0) {
      for (const s of done) {
        entries.push({
          key: `${row.id}:${s.id}`,
          row,
          session: s,
          dateDay: s.completedAt || s.date || row.date,
          sortTime: new Date(s.scheduledAt).getTime() || 0,
          details: s.sessionNotes.trim() || "—",
          outcome: s.outcome.trim(),
          files: s.attachments,
          isEndorse: false,
        });
      }
    } else if (row.status === "resolved") {
      entries.push({
        key: `${row.id}:closure`,
        row,
        session: null,
        dateDay: row.date,
        sortTime: 0,
        details: row.notes.trim() || row.intakeNotes.trim() || "—",
        outcome: "",
        files: [],
        isEndorse: false,
      });
    } else if (row.type === "ADM" && row.referralReady && row.status === "pending") {
      entries.push({
        key: `${row.id}:endorse`,
        row,
        session: null,
        dateDay: row.date,
        sortTime: 0,
        details: row.reason || row.intakeNotes.trim() || "—",
        outcome: "",
        files: [],
        isEndorse: true,
      });
    }
  }
  entries.sort((a, b) => {
    const timeCmp = b.sortTime - a.sortTime;
    if (timeCmp !== 0) return timeCmp;
    return b.dateDay.localeCompare(a.dateDay);
  });
  return entries;
}

export function fileHref(fileUrl: string): string {
  if (/^https?:\/\//i.test(fileUrl)) return fileUrl;
  const base = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").replace(/\/$/, "");
  return `${base}/${fileUrl.replace(/^\//, "")}`;
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function statusVariant(
  status: string
): "warning" | "default" | "secondary" | "outline" | "destructive" | "success" {
  switch (status) {
    case "pending": return "warning";
    case "in_progress": return "default";
    case "follow_up": return "secondary";
    case "info_requested": return "outline";
    case "escalated": return "destructive";
    case "resolved": return "success";
    case "dismissed": return "secondary";
    default: return "outline";
  }
}

export function entryStatusLabel(entry: DocEntry): string {
  if (entry.session) return "Done";
  return NURSE_STATUS_LABELS[entry.row.status] ?? entry.row.status;
}

export function entryStatusVariant(
  entry: DocEntry
): "warning" | "default" | "secondary" | "outline" | "destructive" | "success" {
  if (entry.session) return "success";
  return statusVariant(entry.row.status);
}

export function sortEntries(
  entries: DocEntry[],
  sortKey: SortKey,
  sortDir: "asc" | "desc"
): DocEntry[] {
  const result = [...entries];
  result.sort((a, b) => {
    let cmp = 0;
    switch (sortKey) {
      case "referral": cmp = a.row.id.localeCompare(b.row.id); break;
      case "student": cmp = a.row.student.localeCompare(b.row.student); break;
      case "date": cmp = a.dateDay.localeCompare(b.dateDay); break;
      case "status": cmp = entryStatusLabel(a).localeCompare(entryStatusLabel(b)); break;
    }
    return sortDir === "asc" ? cmp : -cmp;
  });
  return result;
}

export { TYPE_OPTIONS, PAGE_SIZE };
