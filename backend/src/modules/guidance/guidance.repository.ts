import { ADM_STAGE_FLOW, type AdmStage } from "../../services/adm.js";

// Shared guidance data-access: labels, desk pagination, session types.
// Endpoint orchestration lives in src/services/guidance/*.service.ts.

/* Desk-level pagination standard: full list pages = 15, overview previews
   page at the same list size (or 10). Accepts both `pageSize` (new) and
   `limit` (legacy). */
export const GUIDANCE_QUEUE_PAGE_SIZE = 15;
export const GUIDANCE_QUEUE_MAX_PAGE_SIZE = 100;

export function resolveGuidancePageSize(req: { query: unknown }): number {
  const q = req.query as Record<string, unknown>;
  const raw =
    typeof q.pageSize !== "undefined" ? Number(q.pageSize) : Number(q.limit);
  if (!Number.isFinite(raw) || raw <= 0) return GUIDANCE_QUEUE_PAGE_SIZE;
  return Math.min(Math.floor(raw), GUIDANCE_QUEUE_MAX_PAGE_SIZE);
}

export const GRADE_LABELS: Record<string, string> = {
  G7: "Grade 7",
  G8: "Grade 8",
  G9: "Grade 9",
  G10: "Grade 10",
  G11: "Grade 11",
  G12: "Grade 12",
};
export const GRADE_ORDER = Object.keys(GRADE_LABELS);

export const ADM_LABEL = new Map(ADM_STAGE_FLOW.map((s) => [s.stage, s.label]));
export type { AdmStage };

export const GUIDANCE_SESSION_TYPES = [
  "individual",
  "parent_conference",
  "group",
  "home_visit",
] as const;
