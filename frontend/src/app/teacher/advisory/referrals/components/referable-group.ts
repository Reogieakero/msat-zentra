"use client";
export interface ReferableRecord {
  id: string;
  observationDate: string;
  studentId?: string;
  studentName: string;
  section: string;
  lrn: string;
  category: string;
  excerpt: string;
  hasReferral?: boolean;
}
export interface StudentOption {
  key: string;
  studentName: string;
  lrn: string;
  section: string;
  records: ReferableRecord[];
}
export function groupReferable(records: ReferableRecord[]): StudentOption[] {
  const map = new Map<string, StudentOption>();
  for (const r of records) {
    if (r.hasReferral) continue;
    const key = r.studentId ?? r.lrn ?? `${r.studentName} · ${r.lrn}`;
    let entry = map.get(key);
    if (!entry) {
      entry = {
        key,
        studentName: r.studentName,
        lrn: r.lrn,
        section: r.section,
        records: [],
      };
      map.set(key, entry);
    }
    entry.records.push(r);
  }
  return [...map.values()].sort((a, b) => a.studentName.localeCompare(b.studentName));
}
export function truncate(text: string, max: number): string {
  const t = (text ?? "").trim();
  return t.length > max ? `${t.slice(0, max)}…` : t;
}
export function studentLabel(s: Pick<StudentOption, "studentName" | "lrn">): string {
  return `${s.studentName} · ${s.lrn}`;
}
const CATEGORY_LABELS: Record<string, string> = {
  behavioral: "Behavioral",
  bullying: "Bullying",
  academic: "Academic",
  attendance: "Attendance",
  health: "Health",
};
export function categoryLabel(value: string): string {
  return (
    CATEGORY_LABELS[value] ??
    (value.length > 0 ? value.charAt(0).toUpperCase() + value.slice(1) : value)
  );
}
export function recordLabel(r: Pick<ReferableRecord, "observationDate" | "category">): string {
  return `${r.observationDate} · ${categoryLabel(r.category)}`;
}
