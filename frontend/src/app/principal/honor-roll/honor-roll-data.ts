// Backend-derived honor roll for the Principal Honor Roll & Awards page.
// No mock data — candidates are sourced from the Principal Academics summary
// (GET /api/academics), which computes the DepEd honor bands server-side.
//
// The backend returns the confirmed honor-roll pool (honorRollPreview) as the
// authoritative list of students who qualify (all grades finalized, not High
// risk, meets a DepEd tier). We join it against sections[].students[] to pull
// the per-student detail the table needs (lrn, section, grade, subject grid).

import type {
  AcademicsMock,
  HonorRollTier,
  StudentRow,
  SectionSummary,
} from "../academics/academics-data";

export type { HonorRollTier };

export interface CandidateSubjectGrade {
  subject: string;
  code: string;
  transmutedGrade: number;
}

export interface HonorRollCandidate {
  studentId: string;
  name: string;
  lrn: string;
  section: string;
  gradeLevel: number;
  overallAverage: number;
  tier: HonorRollTier;
  subjects: CandidateSubjectGrade[];
}

export interface AwardCategory {
  id: string;
  title: string;
  description: string;
  basis: string;
  icon: "medal" | "calendar" | "star" | "flame" | "book";
}

// School-defined award categories (PLAN.md principal.md §6). These are
// configuration, not computed data — kept as the only non-fetched content on
// this page until the backend exposes an awards endpoint.
export const AWARD_CATEGORIES: AwardCategory[] = [
  {
    id: "perfect-attendance",
    title: "Perfect Attendance",
    description: "Learners with no absences or late marks for the term.",
    basis: "Attendance rate 100%",
    icon: "calendar",
  },
  {
    id: "subject-toppers",
    title: "Subject Toppers",
    description: "Highest transmuted grade per subject across the grade level.",
    basis: "Top score per subject",
    icon: "book",
  },
  {
    id: "leadership",
    title: "Leadership Award",
    description: "Recognized student leaders and club officers.",
    basis: "Faculty nomination",
    icon: "star",
  },
  {
    id: "conduct",
    title: "Conduct Award",
    description: "Exemplary behavior with zero anecdotal records.",
    basis: "No behavioral flags",
    icon: "medal",
  },
];

const SUBJECT_CODES: Record<string, string> = {
  English: "ENG",
  Mathematics: "MATH",
  Science: "SCI",
  Filipino: "FIL",
  "Araling Panlipunan": "AP",
  "Edukasyon sa Pagpapakatao": "ESP",
  TLE: "TLE",
  MAPEH: "MAP",
  ICT: "ICT",
};

function codeFor(subject: string): string {
  return SUBJECT_CODES[subject] ?? subject.slice(0, 4).toUpperCase();
}

function gradeLevelFromLabel(grade: string): number {
  const match = grade.match(/\d+/);
  return match ? Number(match[0]) : 0;
}

function toCandidate(student: StudentRow, section: SectionSummary, tier: HonorRollTier): HonorRollCandidate {
  return {
    studentId: student.studentId,
    name: student.name,
    lrn: student.lrn,
    section: section.section,
    gradeLevel: gradeLevelFromLabel(section.grade),
    overallAverage: student.overallAverage,
    tier,
    subjects: student.subjects
      .filter((s) => s.transmutedGrade != null)
      .map((s) => ({
        subject: s.subject,
        code: codeFor(s.subject),
        transmutedGrade: s.transmutedGrade,
      })),
  };
}

/**
 * Build the full honor-roll candidate list from the academics summary.
 * The confirmed pool (honorRollPreview) is the authoritative qualifier set;
 * section/student detail is joined in for the table grid.
 */
export function deriveHonorRoll(summary: AcademicsMock): {
  candidates: HonorRollCandidate[];
  termLabel: string;
  schoolYear: string;
} {
  const byId = new Map<string, { student: StudentRow; section: SectionSummary; tier: HonorRollTier }>();

  for (const section of summary.sections) {
    for (const student of section.students) {
      const preview = summary.honorRollPreview.find((h) => h.studentId === student.studentId);
      if (preview) {
        byId.set(student.studentId, { student, section, tier: preview.tier });
      }
    }
  }

  const candidates = Array.from(byId.values())
    .map(({ student, section, tier }) => toCandidate(student, section, tier))
    .sort((a, b) => b.overallAverage - a.overallAverage);

  // Reconciliation: the backend's confirmed pool is authoritative. If a preview
  // student isn't present in the section payload (e.g. filtered server-side),
  // they are dropped — surface the mismatch instead of silently undercounting.
  if (summary.honorRollPreview.length !== candidates.length) {
    console.warn(
      `[honor-roll] ${summary.honorRollPreview.length} previewed candidates but only ${candidates.length} joined to section data.`
    );
  }

  return {
    candidates,
    termLabel: summary.termLabel,
    schoolYear: summary.schoolYear,
  };
}

export const HONOR_ROLL_GRADES = [7, 8, 9, 10, 11, 12];
