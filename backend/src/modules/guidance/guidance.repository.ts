import { ADM_STAGE_FLOW, type AdmStage } from "../../services/adm.js";
import { GRADE_LABELS, GRADE_ORDER } from "../../lib/grades.js";
import { MAX_PAGE_SIZE, PAGE_SIZE, resolvePaging } from "../../lib/pagination.js";

export { GRADE_LABELS, GRADE_ORDER };
export { MAX_PAGE_SIZE, PAGE_SIZE };

export const GUIDANCE_QUEUE_PAGE_SIZE = PAGE_SIZE;
export const GUIDANCE_QUEUE_MAX_PAGE_SIZE = MAX_PAGE_SIZE;

export function resolveGuidancePageSize(req: { query: unknown }): number {
  return resolvePaging(req.query, { maxPageSize: GUIDANCE_QUEUE_MAX_PAGE_SIZE }).pageSize;
}

export const ADM_LABEL = new Map(ADM_STAGE_FLOW.map((s) => [s.stage, s.label]));
export type { AdmStage };

export const GUIDANCE_SESSION_TYPES = [
  "individual",
  "parent_conference",
  "group",
  "home_visit",
] as const;
