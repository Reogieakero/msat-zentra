"use client";
import {
  ClipboardList,
  Landmark,
  MessagesSquare,
  Stethoscope,
} from "lucide-react";
export const TARGET_ICONS: Record<string, typeof MessagesSquare> = {
  guidance_counselor: MessagesSquare,
  nurse: Stethoscope,
  adm_coordinator: ClipboardList,
  principal: Landmark,
};
export const TRACK_OPTIONS: { key: string; label: string; icon: typeof MessagesSquare }[] = [
  { key: "adm", label: "ADM case", icon: Landmark },
  { key: "general", label: "Other matter", icon: MessagesSquare },
];
export const CATEGORY_TONES: Record<string, 1 | 2 | 3 | 4 | 5> = {
  behavioral: 1,
  bullying: 2,
  academic: 3,
  attendance: 4,
  health: 5,
};
export const EMPTY_STAGES = ["Referred", "Review", "Parent meeting", "Home visit", "Resolved"];
export const ADM_RECEIVER_LABELS: Record<string, string> = {
  nurse: "School Nurse",
  guidance_counselor: "Guidance Counselor",
  lrpc: "LRPC",
};
export const ADM_RECEIVER_ICONS: Record<string, typeof MessagesSquare> = {
  nurse: Stethoscope,
  guidance_counselor: MessagesSquare,
  lrpc: Landmark,
};
export const TARGET_ROLE_LABELS: Record<string, string> = {
  nurse: "Nurse",
  guidance_counselor: "Guidance Counselor",
  adm_coordinator: "ADM Coordinator",
  principal: "Principal",
};
export const CATEGORY_LABELS: Record<string, string> = {
  behavioral: "Behavioral",
  bullying: "Bullying",
  academic: "Academic",
  attendance: "Attendance",
  health: "Health",
};
export function truncate(text: string, max: number): string {
  const t = (text ?? "").trim();
  return t.length > max ? `${t.slice(0, max)}…` : t || "anecdotal record";
}
export interface AnecdotalRecord {
  id: string;
  observationDate: string;
  studentId?: string;
  studentName: string;
  section: string;
  lrn: string;
  category: string;
  excerpt: string;
  hasReferral?: boolean;
  referralCount?: number;
  hasAccount?: boolean;
}
export interface StudentFolder {
  key: string;
  studentId: string;
  studentName: string;
  lrn: string;
  section: string;
  records: AnecdotalRecord[];
  referableCount: number;
}
export function groupByStudent(records: AnecdotalRecord[]): StudentFolder[] {
  const map = new Map<string, StudentFolder>();
  for (const r of records) {
    const key = r.studentId ?? r.lrn ?? `${r.studentName} · ${r.lrn}`;
    if (!map.has(key)) {
      map.set(key, {
        key,
        studentId: r.studentId ?? r.lrn ?? key,
        studentName: r.studentName,
        lrn: r.lrn,
        section: r.section,
        records: [],
        referableCount: 0,
      });
    }
    const folder = map.get(key)!;
    folder.records.push(r);
    if (!r.hasReferral) folder.referableCount += 1;
    if (!folder.studentName && r.studentName) folder.studentName = r.studentName;
  }
  return Array.from(map.values()).sort((a, b) =>
    a.studentName.localeCompare(b.studentName)
  );
}
export function nextStep(step: number): number {
  return Math.min(4, step + 1);
}
