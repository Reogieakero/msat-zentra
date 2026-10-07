// Live-general-average honor-roll shapes for the Principal Honor Roll &
// Awards page. Candidates come from GET /api/academics/honor-roll-live:
// students whose LIVE general average (mean of graded live subject
// averages, lock-agnostic) is >= 90 with no subject below 80, excluding
// High risk. No lock requirement — work counts the moment scores are
// recorded.
import type { AwardStatus, DescriptorBand } from "./academics";

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

export const HONOR_ROLL_GRADES = [7, 8, 9, 10, 11, 12];
