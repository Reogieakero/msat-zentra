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

const PAGE_SIZE = 15;

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
): "amber" | "default" | "secondary" | "outline" | "destructive" | "success" {
  switch (status) {
    case "pending": return "amber";
    case "in_progress": return "default";
    case "follow_up": return "secondary";
    case "info_requested": return "outline";
    case "escalated": return "destructive";
    case "resolved": return "success";
    case "dismissed": return "destructive";
    default: return "outline";
  }
}

export function entryStatusLabel(entry: DocEntry): string {
  if (entry.session) return "Done";
  return NURSE_STATUS_LABELS[entry.row.status] ?? entry.row.status;
}

export function entryStatusVariant(
  entry: DocEntry
): "amber" | "default" | "secondary" | "outline" | "destructive" | "success" {
  if (entry.session) return "success";
  return statusVariant(entry.row.status);
}

/* Per-student folder over finished transactions — one folder per student
   whose cases appear here. Colors follow the dominant case type so the
   grid reads at a glance. */
export interface StudentHealthFolder {
  key: string;
  student: string;
  lrn: string;
  section: string;
  grade: string;
  dominantType: "ADM" | "Clinic";
  entries: DocEntry[];
  fileCount: number;
  storageBytes: number;
}

export const HEALTH_FOLDER_COLORS: Record<"ADM" | "Clinic", string> = {
  ADM: "#3b82f6",
  Clinic: "#22c55e",
};

function folderIdentity(row: NurseQueueRow): { key: string; lrn: string } {
  // Same identity rules as the overview builder: registered students key
  // by LRN, roster enlistments fall back to name + section.
  const lrn = (row.lrn || "").trim();
  if (lrn && lrn !== "—") return { key: `lrn:${lrn}`, lrn };
  return {
    key: `name:${row.student.trim().toLowerCase()}|${row.section.trim().toLowerCase()}`,
    lrn: "—",
  };
}

export function groupEntriesByStudent(entries: DocEntry[]): StudentHealthFolder[] {
  const map = new Map<string, StudentHealthFolder>();
  for (const e of entries) {
    const { key, lrn } = folderIdentity(e.row);
    let folder = map.get(key);
    if (!folder) {
      folder = {
        key,
        student: e.row.student || "Unknown student",
        lrn,
        section: e.row.section && e.row.section !== "—" ? e.row.section : "",
        grade: e.row.grade && e.row.grade !== "—" ? e.row.grade : "",
        dominantType: "Clinic",
        entries: [],
        fileCount: 0,
        storageBytes: 0,
      };
      map.set(key, folder);
    }
    folder.entries.push(e);
    folder.fileCount += e.files.length;
    for (const f of e.files) {
      if (Number.isFinite(f.fileSize) && f.fileSize > 0) {
        folder.storageBytes += f.fileSize;
      }
    }
    if (!folder.student || folder.student === "Unknown student") {
      folder.student = e.row.student || folder.student;
    }
  }
  const folders = [...map.values()];
  for (const f of folders) {
    // Newest case first inside each folder.
    f.entries.sort((a, b) => b.sortTime - a.sortTime || b.dateDay.localeCompare(a.dateDay));
    const adm = f.entries.filter((e) => e.row.type === "ADM").length;
    f.dominantType = adm * 2 >= f.entries.length ? "ADM" : "Clinic";
  }
  // Most files first — the heaviest records surface on top.
  folders.sort((a, b) => b.fileCount - a.fileCount || b.entries.length - a.entries.length);
  return folders;
}

export function folderStorageBytes(folders: StudentHealthFolder[]): number {
  return folders.reduce((sum, f) => sum + f.storageBytes, 0);
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
