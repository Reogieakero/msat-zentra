import { ADM_STAGE_FLOW, type AdmStage } from "../../services/adm.js";
import { GRADE_LABELS, GRADE_ORDER } from "../../lib/grades.js";

export { GRADE_LABELS, GRADE_ORDER };

export const GUIDANCE_QUEUE_PAGE_SIZE = 15;
export const GUIDANCE_QUEUE_MAX_PAGE_SIZE = 100;

export function resolveGuidancePageSize(req: { query: unknown }): number {
  const q = req.query as Record<string, unknown>;
  const raw =
    typeof q.pageSize !== "undefined" ? Number(q.pageSize) : Number(q.limit);
  if (!Number.isFinite(raw) || raw <= 0) return GUIDANCE_QUEUE_PAGE_SIZE;
  return Math.min(Math.floor(raw), GUIDANCE_QUEUE_MAX_PAGE_SIZE);
}

export const ADM_LABEL = new Map(ADM_STAGE_FLOW.map((s) => [s.stage, s.label]));
export type { AdmStage };

export const GUIDANCE_SESSION_TYPES = [
  "individual",
  "parent_conference",
  "group",
  "home_visit",
] as const;
