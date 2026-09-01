import { apiClient } from "@/lib/api/client";
import type {
  BehavioralCategory,
  BehavioralRecord,
  RecordDataset,
  RecordStudent,
} from "../types";

// Canonical backend anecdotal categories (mirror of the AnecdotalCategory enum
// + CATEGORY_META in backend/src/modules/anecdotal/anecdotal.routes.ts).
export const CATEGORY_META: Record<BehavioralCategory, { label: string; color: string }> = {
  behavioral: { label: "Behavioral", color: "#166534" },
  bullying: { label: "Bullying", color: "#b91c1c" },
  academic: { label: "Academic", color: "#1d4ed8" },
  attendance: { label: "Attendance", color: "#c2410c" },
  health: { label: "Health", color: "#7c3aed" },
};

export const CATEGORY_KEYS = Object.keys(CATEGORY_META) as BehavioralCategory[];

const SEVERITY_RANK: Record<BehavioralRecord["severity"], number> = {
  High: 3,
  Moderate: 2,
  Low: 1,
};

export function titleCase(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

// The dominant anecdotal category for a student = the category of their most
// severe behavioral record.
export function primaryCategory(student: RecordStudent): BehavioralCategory {
  return student.behavioral.reduce((top, rec) =>
    SEVERITY_RANK[rec.severity] > SEVERITY_RANK[top.severity] ? rec : top
  ).category as BehavioralCategory;
}

export function categoryColor(student: RecordStudent): string {
  return CATEGORY_META[primaryCategory(student)].color;
}

// Shape returned by GET /api/anecdotal/records (see backend anecdotal.routes.ts).
type RawBackendRecord = {
  id: string;
  date: string;
  category: BehavioralCategory;
  description: string;
  severity: "Low" | "Moderate" | "High";
  staff: string;
  resolution: string;
  followUp: "Pending" | "Resolved" | "Monitoring";
};

type RawBackendStudent = {
  lrn: string;
  name: string;
  status: string;
  gradeLevel: string; // "G7" … "G12"
  section: string; // e.g. "G7-A"
  sectionId: string;
  behavioral: RawBackendRecord[];
};

type RawBackendSection = {
  sectionId: string;
  section: string;
  gradeLevel: string;
  students: RawBackendStudent[];
};

function normalizeStatus(status: string): RecordStudent["status"] {
  switch (status) {
    case "active":
      return "Active";
    case "pending":
      return "New";
    case "inactive":
    case "archived":
      return "Inactive";
    default:
      return "Active";
  }
}

export function normalizeRecords(raw: {
  schoolYear: string;
  sections: RawBackendSection[];
}): RecordDataset {
  return {
    schoolYear: raw.schoolYear,
    sections: raw.sections.map((section) => ({
      sectionId: section.sectionId,
      section: section.section,
      gradeLevel: section.gradeLevel,
      students: section.students.map((st) => ({
        lrn: st.lrn,
        name: st.name,
        status: normalizeStatus(st.status),
        gradeLevel: st.gradeLevel,
        section: st.section,
        sectionId: st.sectionId,
        academic: {
          averageGrade: "",
          sf10Status: "Missing",
          missingRecords: [],
          completion: 0,
        },
        behavioral: st.behavioral,
      })),
    })),
  };
}

// Shared query function — both the heatblocks and the overview fetch the same
// data and reuse the identical query key (["records-heatmap"]) so React Query
// dedupes them into a single network request.
export async function fetchRecords(): Promise<RecordDataset> {
  const res = await apiClient.get<{ schoolYear: string; sections: RawBackendSection[] }>(
    "/api/anecdotal/records"
  );
  return normalizeRecords(res.data);
}