import {
  ANEC_CATEGORY_LABELS,
  ANEC_TIER_LABELS,
  type AnecdotalCategory,
  type AnecdotalTier,
} from "../../anecdotal/components/anecdotal-data";

/** Guided filing flow constants + per-conversation progress persistence. */

export type TextQuestion = "incident" | "location" | "notes" | "classPerformance" | "attendance";

export const TEXT_QUESTION_LABELS: Record<TextQuestion, string> = {
  incident: "Describe the incident",
  location: "Description of Location/Setting",
  notes: "Notes / Recommendations / Actions",
  classPerformance: "Class Performance",
  attendance: "Attendance in Classes for the last 2 weeks/Month",
};

export const TEXT_QUESTION_PLACEHOLDERS: Record<TextQuestion, string> = {
  incident: "Describe the incident factually…",
  location: "e.g. Classroom, playground, gate…",
  notes: "Next steps, monitoring, referrals…",
  classPerformance: "e.g. Below expectations in Math…",
  attendance: "e.g. 5 absences in the last 2 weeks…",
};

export const NEXT_QUESTION: Record<TextQuestion, TextQuestion | null> = {
  incident: "location",
  location: "notes",
  notes: "classPerformance",
  classPerformance: "attendance",
  attendance: null,
};

export const CATEGORIES = Object.entries(ANEC_CATEGORY_LABELS) as [AnecdotalCategory, string][];
export const TIERS = Object.entries(ANEC_TIER_LABELS) as [AnecdotalTier, string][];

export const CATEGORY_TONES: Record<string, 1 | 2 | 3 | 4 | 5> = {
  behavioral: 1,
  bullying: 2,
  academic: 3,
  attendance: 4,
  health: 5,
};

// Simulated filing stages shown on the progress bar while the record +
// GCForm autofill request is in flight.
export function filingStageFor(progress: number): string {
  if (progress < 30) return "Validating answers…";
  if (progress < 65) return "Filing anecdotal record…";
  if (progress < 97) return "Autofilling GCForm-01…";
  return "Finishing…";
}

export const HOURS_12 = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0"));
export const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));

// Custom (non-native) time parts around the "HH:MM" 24h value the flow stores.
export function splitTime(value: string): { hour: string; minute: string; ampm: string } | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const h24 = parseInt(match[1], 10);
  if (h24 > 23 || parseInt(match[2], 10) > 59) return null;
  return {
    hour: String(h24 % 12 || 12).padStart(2, "0"),
    minute: match[2],
    ampm: h24 < 12 ? "AM" : "PM",
  };
}

// Per-conversation filing progress (student → category → tier → date →
// answers → preview). Persisted alongside chats so switching threads or
// reloading never strands the flow.
export interface FlowSnapshot {
  studentId: string;
  classKey: string;
  category: AnecdotalCategory | null;
  tier: AnecdotalTier | null;
  observationDate: string | null;
  observationTime: string;
  incident: string;
  location: string;
  notes: string;
  classPerf: string;
  attendance: string;
  textQuestion: TextQuestion | null;
  askedCategory: boolean;
  askedTier: boolean;
  askedDatetime: boolean;
  previewShown: boolean;
}

export const EMPTY_FLOW: FlowSnapshot = {
  studentId: "",
  classKey: "",
  category: null,
  tier: null,
  observationDate: null,
  observationTime: "",
  incident: "",
  location: "",
  notes: "",
  classPerf: "",
  attendance: "",
  textQuestion: null,
  askedCategory: false,
  askedTier: false,
  askedDatetime: false,
  previewShown: false,
};

const FLOW_KEY = "zentra.bama.flow.v1";

export function loadFlowStore(): Record<string, FlowSnapshot> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(FLOW_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, FlowSnapshot>;
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

export function saveFlowStore(flows: Record<string, FlowSnapshot>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(FLOW_KEY, JSON.stringify(flows));
  } catch {
    // Storage unavailable — progress simply won't persist.
  }
}
