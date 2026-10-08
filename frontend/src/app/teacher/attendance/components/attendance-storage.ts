"use client";
import type { SheetStatus } from "@/services/teacher/attendance.types";
export const MARKS_STORAGE_KEY = "zentra.attendance-marks";
export const MAX_STORED_SHEETS = 30;
export const VALID_STATUSES: SheetStatus[] = ["present", "absent", "late", "excused"];
export function loadStoredMarks(key: string): Record<string, SheetStatus> {
  try {
    if (typeof window === "undefined") return {};
    const raw = window.localStorage.getItem(MARKS_STORAGE_KEY);
    if (!raw) return {};
    const all = JSON.parse(raw) as Record<string, Record<string, SheetStatus>>;
    const mine = all[key];
    if (!mine || typeof mine !== "object") return {};
    const clean: Record<string, SheetStatus> = {};
    for (const [id, s] of Object.entries(mine)) {
      if ((VALID_STATUSES as string[]).includes(s)) clean[id] = s;
    }
    return clean;
  } catch {
    return {};
  }
}
export function persistStoredMarks(key: string, marks: Record<string, SheetStatus>): void {
  try {
    const raw = window.localStorage.getItem(MARKS_STORAGE_KEY);
    const all: Record<string, Record<string, SheetStatus>> = raw
      ? (JSON.parse(raw) as Record<string, Record<string, SheetStatus>>)
      : {};
    const keys = Object.keys(all);
    if (!all[key] && keys.length >= MAX_STORED_SHEETS) {
      for (const k of keys.slice(0, keys.length - MAX_STORED_SHEETS + 1)) delete all[k];
    }
    all[key] = marks;
    window.localStorage.setItem(MARKS_STORAGE_KEY, JSON.stringify(all));
  } catch {
  }
}
