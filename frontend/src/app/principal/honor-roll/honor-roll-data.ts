// Live-general-average honor roll for the Principal Honor Roll & Awards page.
//
// Candidates come from GET /api/academics/honor-roll-live: students whose
// LIVE general average (mean of graded live subject averages, lock-agnostic)
// is >= 90 with no subject below 80, excluding High risk. No lock
// requirement — work counts the moment scores are recorded.

import { apiClient } from "@/lib/api/client";
import type { AwardStatus, DescriptorBand } from "../academics/academics-data";
import { descriptorBand } from "../academics/academics-data";

export type { AwardStatus, DescriptorBand };

export interface CandidateSubjectGrade {
  subject: string;
  code: string;
  /** Live subject average (1dp) — the basis of the general average. */
  average: number;
}

export interface HonorRollCandidate {
  studentId: string;
  name: string;
  lrn: string;
  section: string;
  gradeLevel: number;
  /** Live general average (mean of graded live subject averages). */
  overallAverage: number;
  /** DO 15, s. 2026 descriptor band derived from the live average. */
  band: DescriptorBand;
  /** Awarded = meets the live rule with no High risk. */
  status: AwardStatus;
  /** Present only for potential candidates. */
  unlockedSubjects?: number;
  subjects: CandidateSubjectGrade[];
}

export interface LiveHonorSubjectDTO {
  subject: string;
  code: string;
  average: number;
}

export interface LiveHonorCandidateDTO {
  studentId: string;
  name: string;
  lrn: string;
  section: string;
  gradeLevel: number;
  generalAverage: number;
  lowestSubject: number;
  subjects: LiveHonorSubjectDTO[];
}

export interface LiveHonorPayload {
  schoolYear: string;
  termLabel: string;
  candidates: LiveHonorCandidateDTO[];
}

export async function fetchLiveHonorRoll(): Promise<LiveHonorPayload> {
  const { data } = await apiClient.get<LiveHonorPayload>("/api/academics/honor-roll-live");
  return data;
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

/**
 * Build the award list from the live honor-roll payload: qualifiers only
 * (live general average >= 90, no subject below 80, not High risk).
 * Sorted by general average, highest first.
 */
export function deriveHonorRoll(payload: LiveHonorPayload): {
  candidates: HonorRollCandidate[];
  termLabel: string;
  schoolYear: string;
} {
  const candidates = [...payload.candidates]
    .map((c) => ({
      studentId: c.studentId,
      name: c.name,
      lrn: c.lrn,
      section: c.section,
      gradeLevel: c.gradeLevel,
      overallAverage: c.generalAverage,
      band: descriptorBand(c.generalAverage),
      status: "awarded" as AwardStatus,
      subjects: [...c.subjects]
        .map((s) => ({
          subject: s.subject,
          code: codeFor(s.subject),
          average: s.average,
        }))
        .sort((a, b) => a.subject.localeCompare(b.subject)),
    }))
    .sort((a, b) => b.overallAverage - a.overallAverage);

  return {
    candidates,
    termLabel: payload.termLabel,
    schoolYear: payload.schoolYear,
  };
}

export const HONOR_ROLL_GRADES = [7, 8, 9, 10, 11, 12];
