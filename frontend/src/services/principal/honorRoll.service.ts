// Live-general-average honor-roll fetch + award-list derivation for the
// Principal Honor Roll & Awards page.
import { apiClient } from "@/lib/api/client";
import { descriptorBand } from "./academics";
import type {
  AwardStatus,
  HonorRollCandidate,
  LiveHonorPayload,
} from "./honorRoll.types";

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
