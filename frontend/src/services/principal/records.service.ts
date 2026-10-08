import { apiClient } from "@/lib/api/client";
import type {
  BehavioralCategory,
  BehavioralRecord,
  RecordDataset,
  RecordSection,
  RecordStudent,
} from "@/app/principal/risk/heatmaps/records/types";

export const CATEGORY_META: Record<BehavioralCategory, { label: string; color: string }> = {
  behavioral: { label: "Behavioral", color: "#f59e0b" },
  bullying: { label: "Bullying", color: "#ef4444" },
  academic: { label: "Academic", color: "#3b82f6" },
  attendance: { label: "Attendance", color: "#22c55e" },
  health: { label: "Health", color: "#8b5cf6" },
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

export function primaryCategory(student: RecordStudent): BehavioralCategory {
  return student.behavioral.reduce((top, rec) =>
    SEVERITY_RANK[rec.severity] > SEVERITY_RANK[top.severity] ? rec : top
  ).category as BehavioralCategory;
}

export function categoryColor(student: RecordStudent): string {
  return CATEGORY_META[primaryCategory(student)].color;
}

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
  gradeLevel: string;
  section: string;
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

  const byLrn = new Map<string, RecordStudent>();
  const sections: RecordSection[] = [];

  for (const section of raw.sections) {
    const students: RecordStudent[] = [];
    for (const st of section.students) {
      const existing = byLrn.get(st.lrn);
      if (existing) {

        const ids = new Set(existing.behavioral.map((r) => r.id));
        for (const rec of st.behavioral) {
          if (!ids.has(rec.id)) {
            ids.add(rec.id);
            existing.behavioral.push(rec);
          }
        }
        continue;
      }
      const normalized: RecordStudent = {
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
        behavioral: [...st.behavioral],
      };
      byLrn.set(st.lrn, normalized);
      students.push(normalized);
    }
    sections.push({
      sectionId: section.sectionId,
      section: section.section,
      gradeLevel: section.gradeLevel,
      students,
    });
  }

  return { schoolYear: raw.schoolYear, sections };
}

export async function fetchRecords(): Promise<RecordDataset> {
  const res = await apiClient.get<{ schoolYear: string; sections: RawBackendSection[] }>(
    "/api/anecdotal/records"
  );
  return normalizeRecords(res.data);
}
