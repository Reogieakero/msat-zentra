import {
  REASON_LABELS,
  type FlagReason,
} from "@/services/teacher/gradeFlags.types";
export interface FiledDetail {
  studentName: string;
  lrn: string;
  section: string;
  subject: string;
  termNumber: number;
  reasonLabel: string;
  note: string;
  owner: string;
  filedOn: string;
}
export interface ChatMessage {
  id: number;
  from: "assistant" | "user";
  text: string;
  detail?: FiledDetail;
}
export const STORAGE_KEY = "zentra.grade-flags.chat";
export function loadMessages(): ChatMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return (parsed as ChatMessage[]).filter(
      (m) =>
        m &&
        typeof m.text === "string" &&
        (m.detail === undefined ||
          (typeof m.detail.studentName === "string" && typeof m.detail.note === "string"))
    );
  } catch {
    return [];
  }
}
export const CATEGORIES = Object.entries(REASON_LABELS) as [FlagReason, string][];
