import type { AwardStatus, DescriptorBand } from "./academics";

export type { AwardStatus, DescriptorBand };

export interface CandidateSubjectGrade {
  subject: string;
  code: string;

  average: number;
}

export interface HonorRollCandidate {
  studentId: string;
  name: string;
  lrn: string;
  section: string;
  gradeLevel: number;

  overallAverage: number;

  band: DescriptorBand;

  status: AwardStatus;

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
