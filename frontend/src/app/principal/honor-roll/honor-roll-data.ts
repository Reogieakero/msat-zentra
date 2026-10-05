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
  AwardStatus,
  DescriptorBand,
  StudentRow,
  SectionSummary,
} from "../academics/academics-data";
import { descriptorBand } from "../academics/academics-data";

export type { AwardStatus, DescriptorBand };

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
  /** DO 15, s. 2026 descriptor band derived from the live average. */
  band: DescriptorBand;
  /** Awarded = all subjects locked; potential = raw grades qualify. */
  status: AwardStatus;
  /** Present only for potential candidates. */
  unlockedSubjects?: number;
  subjects: CandidateSubjectGrade[];
}



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

function toCandidate(
  student: StudentRow,
  section: SectionSummary,
  status: AwardStatus,
  unlockedSubjects?: number
): HonorRollCandidate {
  return {
    studentId: student.studentId,
    name: student.name,
    lrn: student.lrn,
    section: section.section,
    gradeLevel: gradeLevelFromLabel(section.grade),
    overallAverage: student.overallAverage,
    band: descriptorBand(student.overallAverage),
    status,
    unlockedSubjects,
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
 * Build the award list from the academics summary: confirmed qualifiers only
 * (honorRollPreview → awarded, all subjects locked/finalized).
 */
export function deriveHonorRoll(summary: AcademicsMock): {
  candidates: HonorRollCandidate[];
  termLabel: string;
  schoolYear: string;
} {
  const byId = new Map<
    string,
    { student: StudentRow; section: SectionSummary }
  >();

  for (const section of summary.sections) {
    for (const student of section.students) {
      const confirmed = summary.honorRollPreview.find((h) => h.studentId === student.studentId);
      if (confirmed) {
        byId.set(student.studentId, { student, section });
      }
    }
  }

  const candidates = Array.from(byId.values())
    .map(({ student, section }) => toCandidate(student, section, "awarded"))
    .sort((a, b) => b.overallAverage - a.overallAverage);

  // Reconciliation: the backend pool is authoritative. If a pooled student
  // isn't present in the section payload (e.g. filtered server-side), they
  // are dropped — surface the mismatch instead of silently undercounting.
  if (summary.honorRollPreview.length !== candidates.length) {
    console.warn(
      `[honor-roll] ${summary.honorRollPreview.length} pooled candidates but only ${candidates.length} joined to section data.`
    );
  }

  return {
    candidates,
    termLabel: summary.termLabel,
    schoolYear: summary.schoolYear,
  };
}

export const HONOR_ROLL_GRADES = [7, 8, 9, 10, 11, 12];
